import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import {
  createFloorPlanElement,
  deleteFloorPlanElement,
  updateFloorPlanElementPosition,
} from '../../auth/adminFloorPlanElementApi'
import { activateRailSegment, deactivateRailSegment } from '../../auth/adminRailSegmentApi'
import { updateTablePosition } from '../../auth/adminTableApi'
import { listFloorPlanElements, type FloorPlanElement, type FloorPlanElementType } from '../../auth/floorPlanElementApi'
import { listRailSegments, type RailSegment } from '../../auth/railSegmentApi'
import { getStaffAuth } from '../../auth/staffAuth'
import { listTables, type RestaurantTable } from '../../auth/tableApi'
import RailLines from '../../staff/RailLines'
import { formatSeatLabel } from '../../staff/seatLabel'

type Status = 'loading' | 'ready' | 'error'

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

  function handleToggleSegment(segment: RailSegment) {
    setTogglingSegmentId(segment.id)
    const action = segment.active ? deactivateRailSegment : activateRailSegment
    action(segment.id)
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

  function tableLabelById(id: number): string {
    const table = tables.find((t) => t.id === id)
    return table ? formatSeatLabel(table.seatType, table.tableNumber) : `#${id}`
  }

  useEffect(() => {
    if (!drag) return
    const activeDrag = drag

    function handleMove(e: PointerEvent) {
      setDrag((prev) => (prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev))
    }

    function handleUp(e: PointerEvent) {
      const canvas = canvasRef.current
      setDrag(null)
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const withinCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      if (!withinCanvas) return

      const xPercent = ((e.clientX - rect.left) / rect.width) * 100
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100
      const x = Math.min(Math.max(xPercent - activeDrag.width / 2, 0), 100 - activeDrag.width)
      const y = Math.min(Math.max(yPercent - activeDrag.height / 2, 0), 100 - activeDrag.height)
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

  const placedTables = tables.filter(
    (table) => table.x !== null && !(drag?.kind === 'table' && drag.id === table.id),
  )
  const unplacedTables = tables.filter(
    (table) => table.x === null && !(drag?.kind === 'table' && drag.id === table.id),
  )
  const visibleElements = elements.filter(
    (el) => el.type !== 'RAIL' && !(drag?.kind === 'element' && drag.id === el.id),
  )

  const ghostStyle = drag
    ? {
        position: 'fixed' as const,
        left: drag.clientX - ((drag.width / 100) * drag.canvasRect.width) / 2,
        top: drag.clientY - ((drag.height / 100) * drag.canvasRect.height) / 2,
        width: (drag.width / 100) * drag.canvasRect.width,
        height: (drag.height / 100) * drag.canvasRect.height,
        pointerEvents: 'none' as const,
      }
    : null

  return (
    <div className="min-h-screen bg-surface pb-6">
      <header className="flex items-center gap-3 bg-primary-500 px-4 py-5 text-white">
        <button
          type="button"
          onClick={() => navigate('/staff')}
          aria-label="뒤로"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform active:scale-90"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">매장 배치 설정</h1>
      </header>

      <div className="px-4 py-4">
        {status === 'loading' && <p className="py-10 text-center text-muted">불러오는 중입니다...</p>}
        {status === 'error' && <p className="py-10 text-center text-red-600">{errorMessage}</p>}

        {status === 'ready' && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted">
                자리/기물을 끌어다 매장 평면도 위에 배치하세요. 이미 배치된 것도 다시 끌어서 옮길 수 있습니다.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="shrink-0 rounded-full bg-primary-500 px-3.5 py-2 text-sm font-semibold text-white active:scale-95"
              >
                기물 추가
              </button>
            </div>

            <div
              ref={canvasRef}
              className="relative w-full rounded-card border-2 border-dashed border-primary-200 bg-surface-raised"
              style={{ aspectRatio: '4 / 3' }}
            >
              {visibleElements.map((element) => (
                <button
                  key={`element-${element.id}`}
                  type="button"
                  onPointerDown={(e) => startDragElement(element, e)}
                  className={`absolute flex items-center justify-center rounded-lg text-xs font-semibold active:scale-95 ${ELEMENT_TYPE_CLASS[element.type]}`}
                  style={{
                    left: `${element.x}%`,
                    top: `${element.y}%`,
                    width: `${element.width}%`,
                    height: `${element.height}%`,
                    touchAction: 'none',
                  }}
                >
                  {element.label || ELEMENT_TYPE_LABEL[element.type]}
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
                </button>
              ))}

              <RailLines tables={tables} segments={railSegments} />

              {placedTables.map((table) => (
                <button
                  key={`table-${table.id}`}
                  type="button"
                  onPointerDown={(e) => startDragTable(table, e)}
                  className="absolute flex items-center justify-center rounded-lg bg-primary-400 text-xs font-semibold text-white shadow-sm active:scale-95"
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.width}%`,
                    height: `${table.height}%`,
                    touchAction: 'none',
                  }}
                >
                  {formatSeatLabel(table.seatType, table.tableNumber)}
                </button>
              ))}
            </div>

            {drag && ghostStyle && (
              <div
                style={ghostStyle}
                className="flex items-center justify-center rounded-lg bg-primary-600 text-xs font-semibold text-white opacity-80"
              >
                {drag.label}
              </div>
            )}

            <p className="mt-5 mb-2 text-sm font-semibold text-ink">아직 배치 안 한 자리</p>
            {unplacedTables.length === 0 ? (
              <p className="text-sm text-muted">모든 자리를 배치했습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unplacedTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onPointerDown={(e) => startDragTable(table, e)}
                    className="rounded-full bg-primary-50 px-3.5 py-2 text-sm font-semibold text-primary-600 active:scale-95"
                    style={{ touchAction: 'none' }}
                  >
                    {formatSeatLabel(table.seatType, table.tableNumber)}
                  </button>
                ))}
              </div>
            )}

            <p className="mt-6 mb-2 text-sm font-semibold text-ink">
              레일 구간 ({railSegments.filter((s) => s.active).length}/{railSegments.length} 활성)
            </p>
            <p className="mb-2 text-xs text-muted">
              손님이 적을 때는 일부 구간을 꺼서 회전초밥 레일의 순환 범위를 줄일 수 있습니다.
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {railSegments.map((segment) => (
                <li key={segment.id}>
                  <button
                    type="button"
                    disabled={togglingSegmentId === segment.id}
                    onClick={() => handleToggleSegment(segment)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors disabled:opacity-50 ${
                      segment.active ? 'bg-green-100 text-green-700' : 'bg-ink/5 text-muted'
                    }`}
                  >
                    {tableLabelById(segment.fromTableId)} ↔ {tableLabelById(segment.toTableId)}
                    <span className="mt-0.5 block text-[11px] font-normal">
                      {togglingSegmentId === segment.id ? '처리 중...' : segment.active ? '켜짐' : '꺼짐'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {showCreateModal && (
        <FixtureCreateModal onCancel={() => setShowCreateModal(false)} onCreate={handleCreateElement} />
      )}
    </div>
  )
}

export default TableLayoutPage
