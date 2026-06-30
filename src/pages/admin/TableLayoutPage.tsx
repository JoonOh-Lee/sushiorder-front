import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import {
  createFloorPlanElement,
  deleteFloorPlanElement,
  updateFloorPlanElementPosition,
} from '../../api/staff/admin/floorPlanElementApi'
import { activateRailSegment, deactivateRailSegment, reorderRailSegments } from '../../api/staff/admin/railSegmentApi'
import { fetchTableQrBlobUrl, updateTablePosition } from '../../api/staff/admin/tableApi'
import { listFloorPlanElements, type FloorPlanElement, type FloorPlanElementType } from '../../api/staff/floorPlanElementApi'
import { listRailSegments, type RailSegment } from '../../api/staff/railSegmentApi'
import { getStaffAuth } from '../../api/staff/auth'
import { StaffHeader } from '../../components/StaffHeader'
import { listTables, type RestaurantTable } from '../../api/staff/tableApi'
import ConveyorRail from '../../staff/ConveyorRail'
import { computeBeltGeo, computeEffectiveActiveIds, computeReorderFromPositions } from '../../staff/railGeometry'
import { formatSeatLabel } from '../../staff/seatLabel'

type Status = 'loading' | 'ready' | 'error'
type Mode = 'layout' | 'rail'
type RailDirection = 'cw' | 'ccw'

const RAIL_DIRECTION_KEY = 'sushiorder.rail.direction'

// FloorBoardPage의 absolute inset-[5%] 와 동일한 좌표계
const CANVAS_INSET = 0.05
const SNAP_GRID = 2 // drop 시 2% 단위로 스냅

const DEFAULT_SIZE = { width: 18, height: 10 }

const ELEMENT_TYPE_LABEL: Record<FloorPlanElementType, string> = {
  KITCHEN: '주방',
  RAIL: '레일',
  ETC: '기타',
}

const ELEMENT_PRESET_SIZE: Record<FloorPlanElementType, { width: number; height: number }> = {
  KITCHEN: { width: 16, height: 16 },
  RAIL: { width: 40, height: 40 },
  ETC: { width: 10, height: 10 },
}

const ELEMENT_TYPE_CLASS: Record<FloorPlanElementType, string> = {
  KITCHEN: 'bg-ink/70 text-white',
  RAIL: 'border-2 border-dashed border-primary-400 bg-primary-100/60 text-primary-700',
  ETC: 'border-2 border-dashed border-muted bg-surface text-muted',
}

const PREVIEW_PX = 220

interface DragState {
  kind: 'table' | 'element'
  id: number
  label: string
  width: number
  height: number
  clientX: number
  clientY: number
  canvasRect: DOMRect
  snapX: number | null
  snapY: number | null
  guideX: number | null
  guideY: number | null
}

interface SnapItem {
  x: number; y: number; width: number; height: number
}

const SNAP_THRESHOLD = 4

function computeSnap(
  rawX: number, rawY: number, w: number, h: number, items: SnapItem[],
): { x: number; y: number; guideX: number | null; guideY: number | null } {
  let bestX = Math.round(rawX / SNAP_GRID) * SNAP_GRID
  let bestY = Math.round(rawY / SNAP_GRID) * SNAP_GRID
  let guideX: number | null = null
  let guideY: number | null = null
  let minDX = SNAP_THRESHOLD
  let minDY = SNAP_THRESHOLD

  for (const it of items) {
    // x축: left-to-left, center-to-center, left-to-right, right-to-left
    const xCands = [
      { pos: it.x,             guide: it.x },
      { pos: it.x + it.width,  guide: it.x + it.width },
      { pos: it.x - w,         guide: it.x },
      { pos: it.x + it.width / 2 - w / 2, guide: it.x + it.width / 2 },
    ]
    for (const c of xCands) {
      const d = Math.abs(rawX - c.pos)
      if (d < minDX) { minDX = d; bestX = c.pos; guideX = c.guide }
    }
    // y축: top-to-top, center-to-center, top-to-bottom, bottom-to-top
    const yCands = [
      { pos: it.y,              guide: it.y },
      { pos: it.y + it.height,  guide: it.y + it.height },
      { pos: it.y - h,          guide: it.y },
      { pos: it.y + it.height / 2 - h / 2, guide: it.y + it.height / 2 },
    ]
    for (const c of yCands) {
      const d = Math.abs(rawY - c.pos)
      if (d < minDY) { minDY = d; bestY = c.pos; guideY = c.guide }
    }
  }

  return { x: bestX, y: bestY, guideX, guideY }
}

function FixtureCreateModal({
  onCancel,
  onCreate,
}: {
  onCancel: () => void
  onCreate: (input: { type: FloorPlanElementType; label: string; width: number; height: number }) => void
}) {
  const [type, setType] = useState<FloorPlanElementType>('KITCHEN')
  const [label, setLabel] = useState('')
  const [size, setSize] = useState(ELEMENT_PRESET_SIZE.KITCHEN)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    if (!resizing) return

    function handleMove(e: PointerEvent) {
      setSize((prev) => {
        const widthPx = (prev.width / 100) * PREVIEW_PX + e.movementX
        const heightPx = (prev.height / 100) * PREVIEW_PX + e.movementY
        return {
          width: Math.min(Math.max((widthPx / PREVIEW_PX) * 100, 4), 100),
          height: Math.min(Math.max((heightPx / PREVIEW_PX) * 100, 4), 100),
        }
      })
    }

    function handleUp() {
      setResizing(false)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [resizing])

  function handleTypeSelect(nextType: FloorPlanElementType) {
    setType(nextType)
    setSize(ELEMENT_PRESET_SIZE[nextType])
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-card bg-surface-raised p-5 shadow-lg">
        <h2 className="text-lg font-bold text-ink">기물 추가</h2>

        <div className="mt-3 flex gap-2">
          {(['KITCHEN', 'ETC'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeSelect(t)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                type === t ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-600'
              }`}
            >
              {ELEMENT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`이름 (기본값: ${ELEMENT_TYPE_LABEL[type]})`}
          className="mt-3 w-full rounded-xl border border-primary-100 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-primary-400"
        />

        <p className="mt-4 text-xs text-muted">크기 조절: 사각형 모서리를 끌어서 크기를 조정하세요.</p>
        <div
          className="relative mt-2 rounded-lg border border-dashed border-primary-200 bg-surface"
          style={{ width: PREVIEW_PX, height: PREVIEW_PX, margin: '0 auto' }}
        >
          <div
            className={`absolute left-1/2 top-1/2 flex items-center justify-center text-xs font-semibold ${ELEMENT_TYPE_CLASS[type]}`}
            style={{
              width: (size.width / 100) * PREVIEW_PX,
              height: (size.height / 100) * PREVIEW_PX,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {label || ELEMENT_TYPE_LABEL[type]}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                setResizing(true)
              }}
              className="absolute -right-1.5 -bottom-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-primary-600"
              style={{ touchAction: 'none' }}
              aria-label="크기 조절"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/10 py-2.5 text-sm font-semibold text-ink active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() =>
              onCreate({ type, label: label.trim(), width: Math.round(size.width), height: Math.round(size.height) })
            }
            className="flex-1 rounded-full bg-primary-500 py-2.5 text-sm font-semibold text-white active:scale-95"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}

function TableLayoutPage({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [elements, setElements] = useState<FloorPlanElement[]>([])
  const [railSegments, setRailSegments] = useState<RailSegment[]>([])
  const [settingCutoff, setSettingCutoff] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [mode, setMode] = useState<Mode>('layout')
  const [railDirection, setRailDirection] = useState<RailDirection>(
    () => (localStorage.getItem(RAIL_DIRECTION_KEY) as RailDirection | null) ?? 'cw',
  )
  const [qrModal, setQrModal] = useState<{ tableId: number; label: string } | null>(null)
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  useEffect(() => {
    const auth = getStaffAuth()
    if (!auth) {
      navigate('/staff/login')
      return
    }
    if (!onClose && auth.role !== 'ADMIN') {
      navigate('/staff')
      return
    }

    Promise.all([listTables(), listFloorPlanElements(), listRailSegments()])
      .then(([tableResult, elementResult, railResult]) => {
        setTables(tableResult)
        setElements(elementResult)
        setRailSegments(railResult)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '평면도 정보를 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [navigate])

  useEffect(() => {
    if (!qrModal) {
      if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl)
      setQrBlobUrl(null)
      return
    }
    setQrLoading(true)
    fetchTableQrBlobUrl(qrModal.tableId)
      .then((url) => setQrBlobUrl(url))
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'QR 코드를 불러오지 못했습니다.')
        setQrModal(null)
      })
      .finally(() => setQrLoading(false))
  }, [qrModal]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReorderSegments() {
    const geo = computeBeltGeo(elements, tables)
    if (!geo) {
      setErrorMessage('주방 기물이 없어 순서를 계산할 수 없습니다.')
      return
    }
    const orders = computeReorderFromPositions(railSegments, tables, geo)
    if (orders.length === 0) return
    setReordering(true)
    reorderRailSegments(orders)
      .then(() => listRailSegments().then(setRailSegments))
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '순서 재정렬에 실패했습니다.')
      })
      .finally(() => setReordering(false))
  }

  async function handleSetDeactivationPoint(table: RestaurantTable) {
    const seg = railSegments.find((s) => s.toTableId === table.id)
    if (!seg || settingCutoff) return

    // 현재 DB에서 inactive인 구간 모두 수집 (레거시 상태 포함)
    const inactiveSegs = railSegments.filter((s) => !s.active)
    // 클릭한 구간이 유일한 비활성 = 현재 컷오프 → 클리어
    const isOnlyCutoff = inactiveSegs.length === 1 && inactiveSegs[0].id === seg.id

    setSettingCutoff(true)
    setErrorMessage('')

    try {
      // 기존 비활성 구간 전부 활성화 (DB를 깨끗한 상태로)
      if (inactiveSegs.length > 0) {
        const results = await Promise.all(inactiveSegs.map((s) => activateRailSegment(s.id)))
        setRailSegments((prev) => {
          let next = [...prev]
          for (const r of results) next = next.map((s) => (s.id === r.id ? r : s))
          return next
        })
      }

      // 클리어가 아니면 새 컷오프 지점을 비활성화
      if (!isOnlyCutoff) {
        const deactivated = await deactivateRailSegment(seg.id)
        setRailSegments((prev) => prev.map((s) => (s.id === deactivated.id ? deactivated : s)))
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof ApiError ? err.message : '레일 구간 변경에 실패했습니다.')
      listRailSegments().then(setRailSegments).catch(() => {})
    } finally {
      setSettingCutoff(false)
    }
  }

  function handleSwitchMode(next: Mode) {
    if (next === 'rail') setDrag(null)
    setMode(next)
    setErrorMessage('')
  }

  useEffect(() => {
    if (!drag) return
    const activeDrag = drag

    function handleMove(e: PointerEvent) {
      const canvas = canvasRef.current
      if (!canvas) {
        setDrag((prev) => (prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev))
        return
      }
      const rect = canvas.getBoundingClientRect()
      const insetLeft = rect.left + rect.width * CANVAS_INSET
      const insetTop = rect.top + rect.height * CANVAS_INSET
      const insetWidth = rect.width * (1 - 2 * CANVAS_INSET)
      const insetHeight = rect.height * (1 - 2 * CANVAS_INSET)
      const rawX = ((e.clientX - insetLeft) / insetWidth) * 100 - activeDrag.width / 2
      const rawY = ((e.clientY - insetTop) / insetHeight) * 100 - activeDrag.height / 2

      const snapItems: SnapItem[] = [
        ...tables
          .filter(
            (t) =>
              t.x !== null && t.y !== null && t.width !== null && t.height !== null &&
              (activeDrag.kind !== 'table' || t.id !== activeDrag.id),
          )
          .map((t) => ({ x: t.x!, y: t.y!, width: t.width!, height: t.height! })),
        ...elements
          .filter((el) => activeDrag.kind !== 'element' || el.id !== activeDrag.id)
          .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height })),
      ]

      const snapped = computeSnap(rawX, rawY, activeDrag.width, activeDrag.height, snapItems)
      const snapX = Math.min(Math.max(snapped.x, 0), 100 - activeDrag.width)
      const snapY = Math.min(Math.max(snapped.y, 0), 100 - activeDrag.height)

      setDrag((prev) =>
        prev
          ? { ...prev, clientX: e.clientX, clientY: e.clientY, snapX, snapY, guideX: snapped.guideX, guideY: snapped.guideY }
          : prev,
      )
    }

    function handleUp(e: PointerEvent) {
      const canvas = canvasRef.current
      setDrag(null)
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const withinCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      if (!withinCanvas) return

      let x: number
      let y: number
      if (activeDrag.snapX !== null && activeDrag.snapY !== null) {
        x = activeDrag.snapX
        y = activeDrag.snapY
      } else {
        const insetLeft = rect.left + rect.width * CANVAS_INSET
        const insetTop = rect.top + rect.height * CANVAS_INSET
        const insetWidth = rect.width * (1 - 2 * CANVAS_INSET)
        const insetHeight = rect.height * (1 - 2 * CANVAS_INSET)
        const xPercent = ((e.clientX - insetLeft) / insetWidth) * 100
        const yPercent = ((e.clientY - insetTop) / insetHeight) * 100
        const snapG = (v: number) => Math.round(v / SNAP_GRID) * SNAP_GRID
        x = Math.min(Math.max(snapG(xPercent - activeDrag.width / 2), 0), 100 - activeDrag.width)
        y = Math.min(Math.max(snapG(yPercent - activeDrag.height / 2), 0), 100 - activeDrag.height)
      }

      const position = { x, y, width: activeDrag.width, height: activeDrag.height }

      if (activeDrag.kind === 'table') {
        updateTablePosition(activeDrag.id, position)
          .then((updated) => {
            const nextTables = tables.map((t) => (t.id === updated.id ? updated : t))
            setTables(nextTables)
            // 테이블 위치 변경 후 레일 sequenceOrder 자동 재계산
            if (railSegments.length > 0) {
              const geo = computeBeltGeo(elements, nextTables)
              if (geo) {
                const orders = computeReorderFromPositions(railSegments, nextTables, geo)
                reorderRailSegments(orders)
                  .then(() => listRailSegments().then(setRailSegments))
                  .catch(() => {})
              }
            }
          })
          .catch((err: unknown) => {
            setErrorMessage(err instanceof ApiError ? err.message : '위치 저장에 실패했습니다.')
          })
      } else {
        updateFloorPlanElementPosition(activeDrag.id, position)
          .then((updated) => {
            setElements((prev) => prev.map((el) => (el.id === updated.id ? updated : el)))
          })
          .catch((err: unknown) => {
            setErrorMessage(err instanceof ApiError ? err.message : '위치 저장에 실패했습니다.')
          })
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [drag])

  function startDragTable(table: RestaurantTable, e: React.PointerEvent) {
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    setDrag({
      kind: 'table',
      id: table.id,
      label: formatSeatLabel(table.seatType, table.tableNumber),
      width: table.width ?? DEFAULT_SIZE.width,
      height: table.height ?? DEFAULT_SIZE.height,
      clientX: e.clientX,
      clientY: e.clientY,
      canvasRect,
      snapX: null, snapY: null, guideX: null, guideY: null,
    })
  }

  function startDragElement(element: FloorPlanElement, e: React.PointerEvent) {
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    setDrag({
      kind: 'element',
      id: element.id,
      label: element.label || ELEMENT_TYPE_LABEL[element.type],
      width: element.width,
      height: element.height,
      clientX: e.clientX,
      clientY: e.clientY,
      canvasRect,
      snapX: null, snapY: null, guideX: null, guideY: null,
    })
  }

  function handleCreateElement(input: { type: FloorPlanElementType; label: string; width: number; height: number }) {
    const x = Math.min(Math.max(50 - input.width / 2, 0), 100 - input.width)
    const y = Math.min(Math.max(50 - input.height / 2, 0), 100 - input.height)
    createFloorPlanElement({
      type: input.type,
      label: input.label || undefined,
      x,
      y,
      width: input.width,
      height: input.height,
    })
      .then((created) => {
        setElements((prev) => [...prev, created])
        setShowCreateModal(false)
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '기물 추가에 실패했습니다.')
      })
  }

  function handleDeleteElement(id: number) {
    deleteFloorPlanElement(id)
      .then(() => {
        setElements((prev) => prev.filter((el) => el.id !== id))
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '기물 삭제에 실패했습니다.')
      })
  }

  const effectiveActiveSegIds = computeEffectiveActiveIds(railSegments, railDirection)

  function railModeTableClass(table: RestaurantTable): string {
    const seg = railSegments.find((s) => s.toTableId === table.id)
    if (!seg) return 'bg-ink/10 text-muted cursor-default'
    if (settingCutoff) return 'opacity-50 cursor-wait'
    if (!seg.active) {
      // 비활성화 시작점 — 빨간색으로 명확히 표시
      return 'bg-red-400 text-white ring-2 ring-red-300 cursor-pointer active:scale-95'
    }
    if (effectiveActiveSegIds.has(seg.id)) {
      // 활성 구간 — 음식 도달
      return 'bg-primary-400 text-white cursor-pointer active:scale-95'
    }
    // 비활성 구간 (컷오프 이후) — 흐리게
    return 'bg-ink/15 text-muted opacity-60 cursor-pointer active:scale-95'
  }

  const placedTables = tables.filter(
    (table) => table.x !== null && !(drag?.kind === 'table' && drag.id === table.id),
  )
  const unplacedTables = tables.filter(
    (table) => table.x === null && !(drag?.kind === 'table' && drag.id === table.id),
  )
  const visibleElements = elements.filter(
    (el) => el.type !== 'RAIL' && !(drag?.kind === 'element' && drag.id === el.id),
  )

  const insetScale = 1 - 2 * CANVAS_INSET
  const ghostStyle = drag
    ? (() => {
        const w = (drag.width / 100) * drag.canvasRect.width * insetScale
        const h = (drag.height / 100) * drag.canvasRect.height * insetScale
        if (drag.snapX !== null && drag.snapY !== null) {
          const insetLeft = drag.canvasRect.left + drag.canvasRect.width * CANVAS_INSET
          const insetTop = drag.canvasRect.top + drag.canvasRect.height * CANVAS_INSET
          const insetW = drag.canvasRect.width * insetScale
          const insetH = drag.canvasRect.height * insetScale
          return {
            position: 'fixed' as const,
            left: insetLeft + (drag.snapX / 100) * insetW,
            top: insetTop + (drag.snapY / 100) * insetH,
            width: w, height: h,
            pointerEvents: 'none' as const,
          }
        }
        return {
          position: 'fixed' as const,
          left: drag.clientX - w / 2,
          top: drag.clientY - h / 2,
          width: w, height: h,
          pointerEvents: 'none' as const,
        }
      })()
    : null

  return (
    <div className={`flex ${onClose ? 'h-full' : 'h-screen'} flex-col bg-surface`}>
      <StaffHeader title="매장 배치 설정" onClose={onClose} />

      {errorMessage && (
        <p className="shrink-0 bg-red-50 px-4 py-2 text-center text-sm text-red-600">{errorMessage}</p>
      )}

      {/* FloorBoardPage의 legend bar와 동일한 높이/구조 — 캔버스 좌표계 맞춤 */}
      {status === 'ready' && (
        <div className="flex shrink-0 items-center gap-3 border-b border-primary-100 bg-surface-raised px-3 py-1.5 text-[11px] text-muted">
          {/* 배치/레일 탭 */}
          <div className="flex rounded-full bg-ink/8 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => handleSwitchMode('layout')}
              className={`rounded-full px-3 py-0.5 transition-colors ${mode === 'layout' ? 'bg-primary-500 text-white' : 'text-ink'}`}
            >
              배치
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('rail')}
              className={`rounded-full px-3 py-0.5 transition-colors ${mode === 'rail' ? 'bg-primary-500 text-white' : 'text-ink'}`}
            >
              레일
            </button>
          </div>
          {mode === 'layout' ? (
            <>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-200" /> 미배치
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-primary-200 bg-surface" /> 배치됨
              </span>
              <span className="ml-auto text-muted">끌어서 배치하세요</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-400" /> 도달
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> 비활성 시작
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-ink/15" /> 미도달
              </span>
              <span className="ml-auto text-muted">눌러서 시작점 설정</span>
            </>
          )}
        </div>
      )}

      {/* 캔버스 영역 — FloorBoardPage의 relative flex-1 overflow-hidden 과 동일한 구조 */}
      <div ref={canvasRef} className="relative flex-1 overflow-hidden">
        {status === 'loading' && (
          <p className="absolute inset-0 flex items-center justify-center text-muted">불러오는 중입니다...</p>
        )}
        {status === 'error' && (
          <p className="absolute inset-0 flex items-center justify-center text-red-600">데이터를 불러오지 못했습니다.</p>
        )}

        {status === 'ready' && (
          // FloorBoardPage의 absolute inset-[5%] 와 동일한 좌표계
          <div className="absolute inset-[5%]">
            {/* 드래그 중 스냅 그리드 dot 가이드 */}
            {drag && mode === 'layout' && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                  backgroundSize: `${SNAP_GRID}% ${SNAP_GRID}%`,
                  opacity: 0.3,
                }}
              />
            )}
            {/* 자석 스냅 안내선 */}
            {drag?.guideX !== null && drag?.guideX !== undefined && mode === 'layout' && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-primary-500"
                style={{ left: `${drag.guideX}%`, opacity: 0.65 }}
              />
            )}
            {drag?.guideY !== null && drag?.guideY !== undefined && mode === 'layout' && (
              <div
                className="pointer-events-none absolute left-0 right-0 h-px bg-primary-500"
                style={{ top: `${drag.guideY}%`, opacity: 0.65 }}
              />
            )}

            {visibleElements.map((element) => (
              <button
                key={`element-${element.id}`}
                type="button"
                onPointerDown={mode === 'layout' ? (e) => startDragElement(element, e) : undefined}
                className={`absolute z-10 flex items-center justify-center rounded-lg text-xs font-semibold ${
                  mode === 'layout' ? 'active:scale-95' : 'cursor-default'
                } ${ELEMENT_TYPE_CLASS[element.type]}`}
                style={{
                  left: `${element.x}%`,
                  top: `${element.y}%`,
                  width: `${element.width}%`,
                  height: `${element.height}%`,
                  touchAction: 'none',
                }}
              >
                {element.label || ELEMENT_TYPE_LABEL[element.type]}
                {mode === 'layout' && (
                  <span
                    role="button"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      handleDeleteElement(element.id)
                    }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow-sm"
                  >
                    ×
                  </span>
                )}
              </button>
            ))}

            <ConveyorRail elements={elements} segments={railSegments} tables={tables} direction={railDirection} />

            {placedTables.map((table) =>
              mode === 'layout' ? (
                <button
                  key={`table-${table.id}`}
                  type="button"
                  onPointerDown={(e) => startDragTable(table, e)}
                  className="absolute flex items-center justify-center rounded-lg border border-primary-100 bg-surface text-xs font-semibold text-muted shadow-sm active:scale-95"
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.width}%`,
                    height: `${table.height}%`,
                    touchAction: 'none',
                  }}
                >
                  {formatSeatLabel(table.seatType, table.tableNumber)}
                  <span
                    role="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setQrModal({ tableId: table.id, label: formatSeatLabel(table.seatType, table.tableNumber) })
                    }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[8px] font-bold text-white shadow-sm"
                    aria-label="QR 코드 보기"
                  >
                    QR
                  </span>
                </button>
              ) : (
                <button
                  key={`table-${table.id}`}
                  type="button"
                  disabled={settingCutoff}
                  onClick={() => handleSetDeactivationPoint(table)}
                  className={`absolute flex items-center justify-center rounded-lg text-xs font-semibold shadow-sm transition-opacity ${railModeTableClass(table)}`}
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.width}%`,
                    height: `${table.height}%`,
                  }}
                >
                  {formatSeatLabel(table.seatType, table.tableNumber)}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* 하단 컨트롤 바 */}
      {status === 'ready' && (
        <div className="shrink-0 border-t border-primary-100 bg-surface-raised px-4 py-3">
          {mode === 'layout' && (
            <div className="flex items-center gap-3">
              <div className="flex flex-1 gap-2 overflow-x-auto py-0.5" style={{ scrollbarWidth: 'none' }}>
                {unplacedTables.length === 0 ? (
                  <span className="text-sm text-muted">모든 자리 배치 완료</span>
                ) : (
                  unplacedTables.map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      onPointerDown={(e) => startDragTable(table, e)}
                      className="shrink-0 rounded-full bg-primary-50 px-3.5 py-1.5 text-sm font-semibold text-primary-600 active:scale-95"
                      style={{ touchAction: 'none' }}
                    >
                      {formatSeatLabel(table.seatType, table.tableNumber)}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="shrink-0 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-white active:scale-95"
              >
                + 기물 추가
              </button>
            </div>
          )}

        </div>
      )}

      {drag && ghostStyle && (
        <div
          style={ghostStyle}
          className="flex items-center justify-center rounded-lg bg-primary-600 text-xs font-semibold text-white opacity-80"
        >
          {drag.label}
        </div>
      )}

      {/* 레일 모드 FAB (방향 전환 · 순서 재정렬) */}
      {mode === 'rail' && (
        <>
          {fabOpen && (
            <div className="fixed inset-0 z-20" onClick={() => setFabOpen(false)} />
          )}
          <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
            {/* 확장 액션 */}
            <div
              className={`flex flex-col items-end gap-2 transition-all duration-200 ${
                fabOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
              }`}
            >
              <button
                type="button"
                disabled={reordering}
                onClick={() => { handleReorderSegments(); setFabOpen(false) }}
                className="flex items-center gap-2 rounded-full bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink shadow-lg disabled:opacity-50"
              >
                {reordering ? '재정렬 중...' : '순서 재정렬'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRailDirection((d) => {
                    const next = d === 'cw' ? 'ccw' : 'cw'
                    localStorage.setItem(RAIL_DIRECTION_KEY, next)
                    return next
                  })
                  setFabOpen(false)
                }}
                className="flex items-center gap-2 rounded-full bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink shadow-lg"
              >
                {railDirection === 'cw' ? '↻ 시계방향' : '↺ 반시계방향'}
              </button>
            </div>

            {/* 메인 FAB */}
            <button
              type="button"
              onClick={() => setFabOpen((p) => !p)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-700 text-xl text-white shadow-lg transition-transform duration-200 active:scale-90"
              aria-label="레일 설정"
            >
              {fabOpen ? '✕' : '⚙'}
            </button>
          </div>
        </>
      )}

      {showCreateModal && (
        <FixtureCreateModal onCancel={() => setShowCreateModal(false)} onCreate={handleCreateElement} />
      )}

      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setQrModal(null)}
        >
          <div
            className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink">{qrModal.label} QR 코드</h2>
            <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-ink/5">
              {qrLoading && <span className="text-sm text-muted">불러오는 중...</span>}
              {!qrLoading && qrBlobUrl && (
                <img src={qrBlobUrl} alt={`${qrModal.label} QR`} className="h-full w-full rounded-lg object-contain" />
              )}
            </div>
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => setQrModal(null)}
                className="flex-1 rounded-full bg-ink/10 py-2.5 text-sm font-semibold text-ink active:scale-95"
              >
                닫기
              </button>
              {qrBlobUrl && (
                <a
                  href={qrBlobUrl}
                  download={`table-${qrModal.tableId}-qr.png`}
                  className="flex flex-1 items-center justify-center rounded-full bg-primary-500 py-2.5 text-sm font-semibold text-white active:scale-95"
                >
                  다운로드
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TableLayoutPage
