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

function TableLayoutPage() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [elements, setElements] = useState<FloorPlanElement[]>([])
  const [railSegments, setRailSegments] = useState<RailSegment[]>([])
  const [togglingSegmentId, setTogglingSegmentId] = useState<number | null>(null)
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

  useEffect(() => {
    const auth = getStaffAuth()
    if (!auth) {
      navigate('/staff/login')
      return
    }
    if (auth.role !== 'ADMIN') {
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

  function handleToggleTableSegment(table: RestaurantTable) {
    const seg = railSegments.find((s) => s.toTableId === table.id)
    if (!seg) return
    setTogglingSegmentId(seg.id)
    const action = seg.active ? deactivateRailSegment : activateRailSegment
    action(seg.id)
      .then((updated) => {
        setRailSegments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        setTogglingSegmentId(null)
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '레일 구간 변경에 실패했습니다.')
        setTogglingSegmentId(null)
        listRailSegments()
          .then(setRailSegments)
          .catch(() => {})
      })
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
            setTables((prev) => prev.map((table) => (table.id === updated.id ? updated : table)))
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
    if (togglingSegmentId === seg.id) return 'bg-primary-300 text-white animate-pulse cursor-wait'
    return effectiveActiveSegIds.has(seg.id)
      ? 'bg-primary-400 text-white cursor-pointer active:scale-95'
      : 'bg-ink/15 text-muted opacity-60 cursor-pointer active:scale-95'
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
    <div className="flex h-screen flex-col bg-surface">
      <header className="flex shrink-0 items-center gap-3 bg-primary-500 px-4 py-2.5 text-white">
        <button
          type="button"
          onClick={() => navigate('/staff')}
          aria-label="뒤로"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform active:scale-90"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">매장 배치 설정</h1>
        <div className="ml-auto flex rounded-full bg-white/15 p-0.5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => handleSwitchMode('layout')}
            className={`rounded-full px-4 py-1 transition-colors ${mode === 'layout' ? 'bg-white/30' : ''}`}
          >
            배치
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('rail')}
            className={`rounded-full px-4 py-1 transition-colors ${mode === 'rail' ? 'bg-white/30' : ''}`}
          >
            레일
          </button>
        </div>
      </header>

      {errorMessage && (
        <p className="shrink-0 bg-red-50 px-4 py-2 text-center text-sm text-red-600">{errorMessage}</p>
      )}

      {/* FloorBoardPage의 legend bar와 동일한 높이/구조 — 캔버스 좌표계 맞춤 */}
      {status === 'ready' && (
        <div className="flex shrink-0 items-center gap-3 border-b border-primary-100 bg-surface-raised px-3 py-1.5 text-[11px] text-muted">
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
                <span className="h-2.5 w-2.5 rounded-full bg-primary-400" /> 활성
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-ink/15" /> 비활성
              </span>
              <button
                type="button"
                onClick={() =>
                  setRailDirection((d) => {
                    const next = d === 'cw' ? 'ccw' : 'cw'
                    localStorage.setItem(RAIL_DIRECTION_KEY, next)
                    return next
                  })
                }
                className="ml-auto flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 font-semibold text-primary-600 transition-colors active:bg-primary-100"
              >
                {railDirection === 'cw' ? '↻ 시계방향' : '↺ 반시계방향'}
              </button>
              <button
                type="button"
                onClick={handleReorderSegments}
                disabled={reordering}
                className="flex items-center gap-1 rounded-full bg-ink/8 px-2.5 py-0.5 font-semibold text-ink transition-colors active:bg-ink/15 disabled:opacity-50"
              >
                {reordering ? '재정렬 중...' : '순서 재정렬'}
              </button>
              <span className="font-semibold text-ink">
                {railSegments.filter((s) => s.active).length}/{railSegments.length} 구간 활성
              </span>
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
                  disabled={togglingSegmentId !== null}
                  onClick={() => handleToggleTableSegment(table)}
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

          {mode === 'rail' && (
            <p className="text-center text-sm text-muted">
              테이블을 탭하여 직전 구간의 레일을 켜거나 끄세요 ·{' '}
              <span className="font-semibold text-ink">
                {railSegments.filter((s) => s.active).length}/{railSegments.length} 활성
              </span>
            </p>
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
