import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { getStaffAuth } from '../../auth/staffAuth'
import {
  cancelStationItems,
  completeStationItems,
  confirmStationItems,
  listStaffOrders,
  type Order,
  type OrderStatus,
} from '../../auth/staffOrderApi'

type Status = 'loading' | 'ready' | 'error'

const POLL_INTERVAL_MS = 10_000
const ACTION_ERROR_DISPLAY_MS = 4_000

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

function OrderBoardPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [stationId] = useState<number | null>(() => getStaffAuth()?.stationId ?? null)
  const [processingId, setProcessingId] = useState<number | null>(null)

  useEffect(() => {
    const auth = getStaffAuth()
    if (!auth) {
      navigate('/staff/login')
      return
    }
    if (auth.stationId === null) {
      navigate('/staff/station')
      return
    }
    const currentStationId = auth.stationId

    let cancelled = false

    function load() {
      listStaffOrders(currentStationId)
        .then((result) => {
          if (cancelled) return
          setOrders([...result].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
          setStatus('ready')
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setErrorMessage(err instanceof ApiError ? err.message : '주문 목록을 불러오지 못했습니다.')
          setStatus('error')
        })
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [navigate])

  useEffect(() => {
    if (!actionError) return
    const timer = setTimeout(() => setActionError(''), ACTION_ERROR_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [actionError])

  function handleAction(orderId: number, action: (orderId: number, stationId: number) => Promise<Order>) {
    if (stationId === null) return
    setProcessingId(orderId)
    action(orderId, stationId)
      .then((updated) => {
        if (updated.status === 'PENDING' || updated.status === 'CONFIRMED') {
          setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)))
        } else {
          setOrders((prev) => prev.filter((order) => order.id !== updated.id))
        }
        setProcessingId(null)
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : '주문 처리에 실패했습니다.')
        setProcessingId(null)
      })
  }

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
        <h1 className="text-xl font-bold">주문 현황</h1>
      </header>

      {actionError && (
        <p className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">{actionError}</p>
      )}

      <div className="px-4 py-4">
        {status === 'loading' && <p className="py-10 text-center text-muted">불러오는 중입니다...</p>}
        {status === 'error' && <p className="py-10 text-center text-red-600">{errorMessage}</p>}
        {status === 'ready' && orders.length === 0 && (
          <p className="py-10 text-center text-muted">처리할 주문이 없습니다.</p>
        )}
        {status === 'ready' && orders.length > 0 && stationId !== null && (
          <ul className="grid gap-3">
            {orders.map((order) => {
              const myItems = order.items.filter((item) => item.stationId === stationId)
              const otherItems = order.items.filter((item) => item.stationId !== stationId)
              const hasPending = myItems.some((item) => item.status === 'PENDING')
              const hasConfirmed = myItems.some((item) => item.status === 'CONFIRMED')

              return (
                <li key={order.id} className="rounded-card bg-surface-raised p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-accent-400 px-2.5 py-1 text-xs font-semibold text-white">
                      테이블 {order.tableId}
                    </span>
                    <span className="text-sm text-muted">
                      {new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

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

                  {otherItems.length > 0 && (
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

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-primary-100 pt-3">
                    {(hasPending || hasConfirmed) && (
                      <button
                        type="button"
                        disabled={processingId === order.id}
                        onClick={() => handleAction(order.id, cancelStationItems)}
                        className="shrink-0 rounded-full bg-ink/10 px-4 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95 disabled:opacity-50"
                      >
                        취소
                      </button>
                    )}
                    {hasPending && (
                      <button
                        type="button"
                        disabled={processingId === order.id}
                        onClick={() => handleAction(order.id, confirmStationItems)}
                        className="shrink-0 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                      >
                        {processingId === order.id ? '처리 중...' : '접수'}
                      </button>
                    )}
                    {hasConfirmed && (
                      <button
                        type="button"
                        disabled={processingId === order.id}
                        onClick={() => handleAction(order.id, completeStationItems)}
                        className="shrink-0 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                      >
                        {processingId === order.id ? '처리 중...' : '완료'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default OrderBoardPage
