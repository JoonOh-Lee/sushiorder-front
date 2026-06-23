import { useState } from 'react'
import { ApiError } from '../../api/types'
import { placeOrder, type Order } from '../../customer/orderApi'
import type { MenuItem } from '../../customer/menuApi'

export interface CartEntry {
  menu: MenuItem
  quantity: number
}

interface CartPageProps {
  entries: CartEntry[]
  onQuantityChange: (menu: MenuItem, quantity: number) => void
  onBack: () => void
  onOrderComplete: () => void
  onViewOrders: () => void
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

function CartPage({ entries, onQuantityChange, onBack, onOrderComplete, onViewOrders }: CartPageProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)

  const totalPrice = entries.reduce((sum, entry) => sum + entry.menu.price * entry.quantity, 0)

  function handleSubmit() {
    setStatus('submitting')
    placeOrder(entries.map((entry) => ({ menuId: entry.menu.id, quantity: entry.quantity })))
      .then((order) => {
        setCompletedOrder(order)
        setStatus('success')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '주문에 실패했습니다.')
        setStatus('error')
      })
  }

  if (status === 'success' && completedOrder) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
        <p className="text-lg font-bold text-ink">주문이 접수됐습니다!</p>
        <p className="text-muted">총 {completedOrder.totalPrice.toLocaleString()}원</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onOrderComplete}
            className="rounded-full bg-primary-50 px-6 py-2.5 text-sm font-semibold text-primary-600"
          >
            메뉴 더 보기
          </button>
          <button
            type="button"
            onClick={onViewOrders}
            className="rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white"
          >
            주문 현황 보기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <header className="flex items-center gap-3 bg-primary-500 px-4 py-5 text-white">
        <button type="button" onClick={onBack} className="text-lg">
          ←
        </button>
        <h1 className="text-xl font-bold">장바구니</h1>
      </header>

      <div className="px-4 py-4">
        {entries.length === 0 ? (
          <p className="py-10 text-center text-muted">장바구니가 비었습니다.</p>
        ) : (
          <ul className="grid gap-3">
            {entries.map((entry) => (
              <li
                key={entry.menu.id}
                className="flex items-center justify-between gap-3 rounded-card bg-surface-raised p-3 shadow-sm"
              >
                <div>
                  <h3 className="font-semibold text-ink">{entry.menu.name}</h3>
                  <p className="mt-1 font-bold text-primary-600">
                    {(entry.menu.price * entry.quantity).toLocaleString()}원
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(entry.menu, entry.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-semibold text-ink">{entry.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(entry.menu, entry.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {status === 'error' && <p className="mt-3 text-center text-red-600">{errorMessage}</p>}
      </div>

      {entries.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface-raised px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mb-2 flex items-center justify-between text-sm text-muted">
            <span>총 {entries.reduce((sum, e) => sum + e.quantity, 0)}개</span>
            <span className="text-base font-bold text-ink">{totalPrice.toLocaleString()}원</span>
          </div>
          <button
            type="button"
            disabled={status === 'submitting'}
            onClick={handleSubmit}
            className="w-full rounded-full bg-primary-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {status === 'submitting' ? '주문 중...' : '주문하기'}
          </button>
        </div>
      )}
    </div>
  )
}

export default CartPage
