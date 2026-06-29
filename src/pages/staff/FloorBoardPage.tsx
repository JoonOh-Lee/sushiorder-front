import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { listFloorPlanElements, type FloorPlanElement, type FloorPlanElementType } from '../../api/staff/floorPlanElementApi'
import { listRailSegments, type RailSegment } from '../../api/staff/railSegmentApi'
import { listStations, setMyDuty, type Station } from '../../api/staff/stationApi'
import { clearStaffAuth, getStaffAuth, updateStaffAuthOnDuty, type StaffAuth } from '../../api/staff/auth'
import { listStaffCalls, resolveStaffCall, type CallType, type StaffCall } from '../../api/staff/callApi'
import {
  cancelStationItems,
  completeStationItems,
  confirmStationItems,
  listAllActiveOrders,
  type Order,
  type OrderStatus,
} from '../../api/staff/orderApi'
import { listTables, type RestaurantTable } from '../../api/staff/tableApi'
import { formatTime } from '../../utils/format'
import ConveyorRail from '../../staff/ConveyorRail'
import { formatSeatLabel } from '../../staff/seatLabel'

type Status = 'loading' | 'ready' | 'error'
type RailDirection = 'cw' | 'ccw'

const RAIL_DIRECTION_KEY = 'sushiorder.rail.direction'

const ELEMENT_TYPE_LABEL: Record<FloorPlanElementType, string> = {
  KITCHEN: '주방',
  RAIL: '레일',
  ETC: '기타',
}

const ELEMENT_TYPE_CLASS: Record<FloorPlanElementType, string> = {
  KITCHEN: 'bg-ink/70 text-white',
  RAIL: 'border-2 border-dashed border-primary-400 bg-primary-100/60 text-primary-700',
  ETC: 'border-2 border-dashed border-muted bg-surface text-muted',
}

const POLL_INTERVAL_MS = 10_000
const ACTION_ERROR_DISPLAY_MS = 4_000
const COVERING_STORAGE_PREFIX = 'sushiorder.staff.covering.'

const ROLE_LABEL: Record<StaffAuth['role'], string> = {
  STAFF: '직원',
  ADMIN: '관리자',
}

const CALL_TYPE_LABEL: Record<CallType, string> = {
  WATER_REFILL: '물 리필',
  INQUIRY: '문의',
  ITEM_REQUEST: '물품 요청',
  OTHER: '기타',
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '접수',
  CONFIRMED: '조리중',
  COMPLETED: '완료',
  CANCELLED: '취소됨',
}

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING: 'bg-accent-400 text-white',
  CONFIRMED: 'bg-primary-400 text-white',
  COMPLETED: 'bg-primary-600 text-white',
  CANCELLED: 'bg-ink/10 text-muted',
}

function loadCoveringStationIds(username: string): number[] {
  try {
    const raw = localStorage.getItem(`${COVERING_STORAGE_PREFIX}${username}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}

interface CallCardProps {
  call: StaffCall
  processing: boolean
  onResolve: () => void
  tableLabel?: string
}

function CallCard({ call, processing, onResolve, tableLabel }: CallCardProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-card bg-surface-raised p-4 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">
            {tableLabel ?? '호출'}
          </span>
          <span className="text-sm text-muted">
            {formatTime(call.createdAt)}
          </span>
        </div>
        <p className="mt-1.5 text-lg font-bold text-ink">
          {CALL_TYPE_LABEL[call.type]}
          {call.itemName && ` · ${call.itemName}`}
        </p>
      </div>
      <button
        type="button"
        disabled={processing}
        onClick={onResolve}
        className="shrink-0 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
      >
        {processing ? '처리 중...' : '처리완료'}
      </button>
    </li>
  )
}

interface OrderCardProps {
  order: Order
  stationId: number
  processing?: boolean
  onAction?: (action: (orderId: number, stationId: number) => Promise<Order>) => void
  tableLabel?: string
  readOnly?: boolean
}

function OrderCard({ order, stationId, processing, onAction, tableLabel, readOnly }: OrderCardProps) {
  const myItems = order.items.filter((item) => item.stationId === stationId)
  const otherItems = order.items.filter((item) => item.stationId !== stationId)
  const hasPending = myItems.some((item) => item.status === 'PENDING')
  const hasConfirmed = myItems.some((item) => item.status === 'CONFIRMED')

  return (
    <li className="rounded-card bg-surface-raised p-4 shadow-sm">
      <div className="flex items-center justify-between">
        {tableLabel && (
          <span className="rounded-full bg-accent-400 px-2.5 py-1 text-xs font-semibold text-white">{tableLabel}</span>
        )}
        <span className="text-sm text-muted">
          {formatTime(order.createdAt)}
        </span>
      </div>

      {myItems.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {myItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm text-ink">
              <span>
                {item.menuName} x{item.quantity}
              </span>
              <div className="flex items-center gap-2">
                <span>{item.subtotal.toLocaleString()}원</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASS[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && otherItems.length > 0 && (
        <ul className="mt-2 grid gap-1 opacity-50">
          {otherItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm text-muted">
              <span>
                {item.menuName} x{item.quantity} (다른 스테이션)
              </span>
              <span>{STATUS_LABEL[item.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && onAction && (hasPending || hasConfirmed) && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-primary-100 pt-3">
          <button
            type="button"
            disabled={processing}
            onClick={() => onAction(cancelStationItems)}
            className="shrink-0 rounded-full bg-ink/10 px-4 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95 disabled:opacity-50"
          >
            취소
          </button>
          {hasPending && (
            <button
              type="button"
              disabled={processing}
              onClick={() => onAction(confirmStationItems)}
              className="shrink-0 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              {processing ? '처리 중...' : '접수'}
            </button>
          )}
          {hasConfirmed && (
            <button
              type="button"
              disabled={processing}
              onClick={() => onAction(completeStationItems)}
              className="shrink-0 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              {processing ? '처리 중...' : '완료'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function ReadOnlyOrderSummary({ order, tableLabel }: { order: Order; tableLabel?: string }) {
  return (
    <li className="rounded-card bg-surface-raised p-4 opacity-70 shadow-sm">
      <div className="flex items-center justify-between">
        {tableLabel && (
          <span className="rounded-full bg-accent-400 px-2.5 py-1 text-xs font-semibold text-white">{tableLabel}</span>
        )}
        <span className="text-sm text-muted">
          {formatTime(order.createdAt)}
        </span>
      </div>
      <ul className="mt-3 grid gap-1">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm text-muted">
            <span>
              {item.menuName} x{item.quantity}
            </span>
            <span>{STATUS_LABEL[item.status]}</span>
          </li>
        ))}
      </ul>
    </li>
  )
}

function FloorBoardPage() {
  const navigate = useNavigate()
  const [auth] = useState<StaffAuth | null>(() => getStaffAuth())
  const [stations, setStations] = useState<Station[]>([])
  const [onDuty, setOnDuty] = useState<boolean>(() => getStaffAuth()?.onDuty ?? false)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [elements, setElements] = useState<FloorPlanElement[]>([])
  const [railSegments, setRailSegments] = useState<RailSegment[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [calls, setCalls] = useState<StaffCall[]>([])
  const stationId = auth?.stationId ?? null
  const [coveringStationIds, setCoveringStationIds] = useState<number[]>(() => (auth ? loadCoveringStationIds(auth.username) : []))
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [railDirection] = useState<RailDirection>(
    () => (localStorage.getItem(RAIL_DIRECTION_KEY) as RailDirection | null) ?? 'cw',
  )

  useEffect(() => {
    if (!auth) {
      navigate('/staff/login')
      return
    }
    if (auth.stationId === null) {
      navigate('/staff/station')
    }
  }, [auth, navigate])

  useEffect(() => {
    if (!auth) return
    localStorage.setItem(`${COVERING_STORAGE_PREFIX}${auth.username}`, JSON.stringify(coveringStationIds))
  }, [auth, coveringStationIds])

  useEffect(() => {
    if (!auth || auth.stationId === null) return

    let cancelled = false

    function load() {
      Promise.all([listTables(), listFloorPlanElements(), listRailSegments(), listAllActiveOrders(), listStaffCalls(), listStations()])
        .then(([tableResult, elementResult, railResult, orderResult, callResult, stationResult]) => {
          if (cancelled) return
          setTables(tableResult)
          setElements(elementResult)
          setRailSegments(railResult)
          setOrders([...orderResult].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
          setCalls([...callResult].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
          setStations(stationResult)
          setStatus('ready')
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setErrorMessage(err instanceof ApiError ? err.message : '현황을 불러오지 못했습니다.')
          setStatus('error')
        })
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [auth])

  useEffect(() => {
    if (!actionError) return
    const timer = setTimeout(() => setActionError(''), ACTION_ERROR_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [actionError])

  function handleLogout() {
    clearStaffAuth()
    navigate('/staff/login')
  }

  function handleToggleDuty() {
    const next = !onDuty
    setMyDuty(next)
      .then(() => {
        setOnDuty(next)
        updateStaffAuthOnDuty(next)
        setShowMenu(false)
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : '근무 상태 변경에 실패했습니다.')
        setShowMenu(false)
      })
  }

  function addCoverage(id: number) {
    setCoveringStationIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  function removeCoverage(id: number) {
    setCoveringStationIds((prev) => prev.filter((s) => s !== id))
  }

  function handleOrderAction(order: Order, forStationId: number, action: (orderId: number, stationId: number) => Promise<Order>) {
    const key = `order-${order.id}-${forStationId}`
    setProcessingKey(key)
    action(order.id, forStationId)
      .then((updated) => {
        if (updated.status === 'PENDING' || updated.status === 'CONFIRMED') {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
        } else {
          setOrders((prev) => prev.filter((o) => o.id !== updated.id))
        }
        setProcessingKey(null)
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : '주문 처리에 실패했습니다.')
        setProcessingKey(null)
      })
  }

  function handleResolveCall(call: StaffCall) {
    const key = `call-${call.id}`
    setProcessingKey(key)
    resolveStaffCall(call.id)
      .then(() => {
        setCalls((prev) => prev.filter((c) => c.id !== call.id))
        setProcessingKey(null)
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : '호출 처리에 실패했습니다.')
        setProcessingKey(null)
      })
  }

  const responsibleStationIds = Array.from(new Set([stationId, ...coveringStationIds].filter((id): id is number => id !== null)))

  function tableHighlightClass(table: RestaurantTable): string {
    const tableOrders = orders.filter((order) => order.tableId === table.id)
    const tableCalls = calls.filter((call) => call.tableId === table.id)
    const hasCall = tableCalls.length > 0
    const hasMyActive = tableOrders.some((order) =>
      order.items.some(
        (item) => responsibleStationIds.includes(item.stationId) && (item.status === 'PENDING' || item.status === 'CONFIRMED'),
      ),
    )
    const hasAnyActive = tableOrders.some((order) =>
      order.items.some((item) => item.status === 'PENDING' || item.status === 'CONFIRMED'),
    )

    if (hasCall) return 'bg-red-500 text-white animate-pulse'
    if (hasMyActive) return 'bg-accent-400 text-white'
    if (hasAnyActive) return 'bg-primary-600 text-white'
    if (table.status === 'OCCUPIED') return 'bg-ink/15 text-ink'
    if (table.status === 'RESERVED') return 'bg-amber-200 text-ink'
    return 'border border-primary-100 bg-surface text-muted'
  }

  const placedTables = tables.filter((table) => table.x !== null)

  function tableLabelFor(tableId: number): string | undefined {
    const table = tables.find((t) => t.id === tableId)
    return table ? formatSeatLabel(table.seatType, table.tableNumber) : undefined
  }

  function stationNameFor(id: number): string {
    return stations.find((s) => s.id === id)?.name ?? `스테이션 ${id}`
  }

  const otherStationIds = Array.from(
    new Set(
      orders
        .flatMap((order) => order.items.map((item) => item.stationId))
        .filter((id) => {
          if (responsibleStationIds.includes(id)) return false
          const station = stations.find((s) => s.id === id)
          return !station?.hasOnDutyStaff
        }),
    ),
  )

  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null
  const selectedTableOrders = selectedTable ? orders.filter((order) => order.tableId === selectedTable.id) : []
  const selectedTableCalls = selectedTable ? calls.filter((call) => call.tableId === selectedTable.id) : []

  const pendingBadgeCount =
    calls.length +
    orders.filter((order) =>
      order.items.some((item) => responsibleStationIds.includes(item.stationId) && item.status === 'PENDING'),
    ).length

  if (!auth || auth.stationId === null) return null

  return (
    <div className="flex h-screen flex-col bg-surface">
      <header className="flex items-center justify-between bg-primary-500 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">
            {auth.username} · {ROLE_LABEL[auth.role]} · {stationNameFor(auth.stationId)}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${onDuty ? 'bg-green-400 text-white' : 'bg-white/25 text-white'}`}>
            {onDuty ? '근무 중' : 'OFF'}
          </span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            aria-label="설정"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base transition-transform active:scale-90"
          >
            ⚙
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl bg-surface-raised text-ink shadow-lg">
                <button
                  type="button"
                  onClick={handleToggleDuty}
                  className={`block w-full px-4 py-3 text-left text-sm font-semibold ${onDuty ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                >
                  {onDuty ? '근무 종료' : '근무 시작'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    navigate('/staff/station')
                  }}
                  className="block w-full px-4 py-3 text-left text-sm font-medium hover:bg-primary-50"
                >
                  스테이션 변경
                </button>
                {auth.role === 'ADMIN' && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setShowMenu(false); navigate('/admin/menu') }}
                      className="block w-full px-4 py-3 text-left text-sm font-medium hover:bg-primary-50"
                    >
                      메뉴 관리
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMenu(false); navigate('/admin/table-layout') }}
                      className="block w-full px-4 py-3 text-left text-sm font-medium hover:bg-primary-50"
                    >
                      매장 배치 설정
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    handleLogout()
                  }}
                  className="block w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {actionError && <p className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">{actionError}</p>}

      {status === 'ready' && stationId !== null && (
        <div className="flex flex-wrap items-center gap-3 border-b border-primary-100 bg-surface-raised px-3 py-1.5 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> 호출
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-400" /> 내 처리
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-primary-600" /> 타 처리중
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-ink/30" /> 착석
          </span>
          {coveringStationIds.length > 0 && (
            <span className="ml-auto text-muted">
              커버 중: {coveringStationIds.map(stationNameFor).join(', ')}
            </span>
          )}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden px-3 py-3">
        {status === 'loading' && <p className="py-10 text-center text-muted">불러오는 중입니다...</p>}
        {status === 'error' && <p className="py-10 text-center text-red-600">{errorMessage}</p>}

        {status === 'ready' && stationId !== null && (
          <>
            <div className="absolute inset-[5%]">
              {elements.filter((e) => e.type !== 'RAIL').map((element) => (
                <div
                  key={`element-${element.id}`}
                  className={`absolute flex items-center justify-center text-xs font-semibold ${ELEMENT_TYPE_CLASS[element.type]}`}
                  style={{
                    left: `${element.x}%`,
                    top: `${element.y}%`,
                    width: `${element.width}%`,
                    height: `${element.height}%`,
                  }}
                >
                  {element.label || ELEMENT_TYPE_LABEL[element.type]}
                </div>
              ))}

              <ConveyorRail elements={elements} segments={railSegments} tables={tables} direction={railDirection} />

              {placedTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTableId(table.id)}
                  className={`absolute flex items-center justify-center rounded-lg text-xs font-semibold shadow-sm transition-transform active:scale-95 ${tableHighlightClass(table)} ${
                    selectedTableId === table.id ? 'ring-2 ring-primary-600' : ''
                  }`}
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.width}%`,
                    height: `${table.height}%`,
                  }}
                >
                  {formatSeatLabel(table.seatType, table.tableNumber)}
                </button>
              ))}
            </div>

            {selectedTable && (
              <div
                className="absolute inset-0 z-10 bg-ink/30"
                onClick={() => setSelectedTableId(null)}
              />
            )}

            {selectedTable && (
              <div className="absolute inset-x-4 bottom-4 z-20 max-h-[55%] overflow-y-auto rounded-card bg-surface-raised p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-ink">
                    {formatSeatLabel(selectedTable.seatType, selectedTable.tableNumber)}
                  </h2>
                  <button type="button" onClick={() => setSelectedTableId(null)} className="text-sm text-muted">
                    닫기
                  </button>
                </div>

                {selectedTableCalls.length === 0 && selectedTableOrders.length === 0 && (
                  <p className="mt-3 text-sm text-muted">처리할 호출/주문이 없습니다.</p>
                )}

                {selectedTableCalls.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {selectedTableCalls.map((call) => (
                      <CallCard
                        key={call.id}
                        call={call}
                        processing={processingKey === `call-${call.id}`}
                        onResolve={() => handleResolveCall(call)}
                      />
                    ))}
                  </ul>
                )}

                {selectedTableOrders.length > 0 && (
                  <ul className="mt-2 grid gap-2">
                    {selectedTableOrders.flatMap((order) => {
                      const relevant = responsibleStationIds.filter((id) => order.items.some((item) => item.stationId === id))
                      if (relevant.length === 0) {
                        return [<ReadOnlyOrderSummary key={order.id} order={order} />]
                      }
                      return relevant.map((stId) => (
                        <OrderCard
                          key={`${order.id}-${stId}`}
                          order={order}
                          stationId={stId}
                          processing={processingKey === `order-${order.id}-${stId}`}
                          onAction={(action) => handleOrderAction(order, stId, action)}
                        />
                      ))
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {status === 'ready' && stationId !== null && (
        <div className="border-t border-primary-100 bg-surface-raised px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              listStations().then(setStations).catch(() => {})
              setShowListModal(true)
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent-500 py-3.5 text-sm font-bold text-white shadow-md transition-transform active:scale-[0.98]"
          >
            주문목록 보기
            {pendingBadgeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-accent-600">
                {pendingBadgeCount}
              </span>
            )}
          </button>
        </div>
      )}

      {showListModal && stationId !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4">
          <div className="absolute inset-0" onClick={() => setShowListModal(false)} />
          <div className="relative flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-card bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-primary-100 px-4 py-3">
              <h2 className="text-lg font-bold text-ink">주문목록</h2>
              <button type="button" onClick={() => setShowListModal(false)} className="text-sm text-muted">
                닫기
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">호출 ({calls.length})</h3>
            {calls.length === 0 ? (
              <p className="py-2 text-sm text-muted">처리할 호출이 없습니다.</p>
            ) : (
              <ul className="grid gap-3">
                {calls.map((call) => (
                  <CallCard
                    key={call.id}
                    call={call}
                    processing={processingKey === `call-${call.id}`}
                    onResolve={() => handleResolveCall(call)}
                    tableLabel={tableLabelFor(call.tableId)}
                  />
                ))}
              </ul>
            )}

            {responsibleStationIds.map((respStationId) => {
              const isMine = respStationId === stationId
              const sectionOrders = orders.filter((order) =>
                order.items.some((item) => item.stationId === respStationId),
              )
              return (
                <div key={respStationId}>
                  <div className="mt-6 mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">
                      {isMine ? '내 스테이션' : `커버 중: ${stationNameFor(respStationId)}`} 주문 ({sectionOrders.length})
                    </h3>
                    {!isMine && (
                      <button
                        type="button"
                        onClick={() => removeCoverage(respStationId)}
                        className="text-xs font-semibold text-muted"
                      >
                        커버 해제
                      </button>
                    )}
                  </div>
                  {sectionOrders.length === 0 ? (
                    <p className="py-2 text-sm text-muted">처리할 주문이 없습니다.</p>
                  ) : (
                    <ul className="grid gap-3">
                      {sectionOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          stationId={respStationId}
                          processing={processingKey === `order-${order.id}-${respStationId}`}
                          onAction={(action) => handleOrderAction(order, respStationId, action)}
                          tableLabel={tableLabelFor(order.tableId)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}

            {otherStationIds.map((otherStationId) => {
              const stationOrders = orders.filter((order) =>
                order.items.some((item) => item.stationId === otherStationId),
              )
              return (
                <div key={otherStationId}>
                  <div className="mt-6 mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">
                      {stationNameFor(otherStationId)} 주문 ({stationOrders.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => addCoverage(otherStationId)}
                      className="text-xs font-semibold text-primary-600"
                    >
                      커버하기
                    </button>
                  </div>
                  <ul className="grid gap-3">
                    {stationOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        stationId={otherStationId}
                        tableLabel={tableLabelFor(order.tableId)}
                        readOnly
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FloorBoardPage
