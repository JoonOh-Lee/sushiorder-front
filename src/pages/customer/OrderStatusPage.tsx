import { useState } from 'react'
import { ApiError } from '../../api/types'
import { getMyOrders, type Order, type OrderStatus } from '../../customer/orderApi'
import { usePolling } from '../../hooks/usePolling'
import { formatSeatLabel, type SeatType } from '../../customer/seat'

type Status = 'loading' | 'ready' | 'error'

const POLL_INTERVAL_MS = 10_000

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

interface OrderStatusPageProps {
  seat: { seatType: SeatType; tableNumber: number } | null
  onBack: () => void
}

function OrderStatusPage({ seat, onBack }: OrderStatusPageProps) {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [orders, setOrders] = useState<Order[]>([])

  function load() {
    getMyOrders()
      .then((result) => {
        setOrders([...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        setStatus('ready')
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : '주문 내역을 불러오지 못했습니다.'
        setStatus((prev) => {
          if (prev === 'loading') { setErrorMessage(msg); return 'error' }
          return prev
        })
      })
  }

  usePolling(load, POLL_INTERVAL_MS)

  return (
    <div className="min-h-screen bg-surface pb-6">
      <header className="flex items-center gap-3 bg-primary-500 px-4 py-5 text-white">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform active:scale-90"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">주문 현황</h1>
          {seat && <p className="text-sm font-medium text-primary-50">{formatSeatLabel(seat.seatType, seat.tableNumber)}</p>}
        </div>
      </header>

      <div className="px-4 py-4">
        {status === 'loading' && <p className="py-10 text-center text-muted">불러오는 중입니다...</p>}
        {status === 'error' && <p className="py-10 text-center text-red-600">{errorMessage}</p>}
        {status === 'ready' && orders.length === 0 && (
          <p className="py-10 text-center text-muted">아직 주문 내역이 없습니다.</p>
        )}
        {status === 'ready' && orders.length > 0 && (
          <ul className="grid gap-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-card bg-surface-raised p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    {new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>

                <ul className="mt-3 grid gap-1">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm text-ink">
                      <span>
                        {item.menuName} x{item.quantity}
                      </span>
                      <span>{item.subtotal.toLocaleString()}원</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-primary-100 pt-2">
                  <span className="text-sm text-muted">합계</span>
                  <span className="font-bold text-primary-600">{order.totalPrice.toLocaleString()}원</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default OrderStatusPage
