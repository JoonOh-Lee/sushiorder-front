import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { createSession, getSessionByToken, type TableSessionResponse } from '../../customer/sessionApi'
import { getSessionToken, setSessionToken } from '../../customer/session'
import type { SeatType } from '../../customer/seat'
import type { MenuItem } from '../../customer/menuApi'
import MenuListPage from './MenuListPage'
import CartPage, { type CartEntry } from './CartPage'
import OrderStatusPage from './OrderStatusPage'

type Status = 'loading' | 'ready' | 'error'
type View = 'menu' | 'orders'

function OrderEntryPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [seat, setSeat] = useState<{ seatType: SeatType; tableNumber: number } | null>(null)
  const [view, setView] = useState<View>('menu')
  const [cart, setCart] = useState<Record<number, CartEntry>>({})
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cartSheetKey, setCartSheetKey] = useState(0)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true

    const numericTableId = Number(tableId)

    Promise.resolve()
      .then(() => {
        if (!tableId || Number.isNaN(numericTableId)) {
          throw new ApiError('잘못된 테이블 정보입니다.')
        }

        const existingToken = getSessionToken()
        if (!existingToken) {
          return createSession(numericTableId)
        }

        return getSessionByToken(existingToken)
          .then((session) => {
            if (session.tableId !== numericTableId || session.status !== 'ACTIVE') {
              throw new Error('기존 세션을 재사용할 수 없습니다.')
            }
            return session
          })
          .catch(() => createSession(numericTableId))
      })
      .then(({ sessionToken, seatType, tableNumber }: TableSessionResponse) => {
        setSessionToken(sessionToken)
        setSeat({ seatType, tableNumber })
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '세션 생성에 실패했습니다.')
        setStatus('error')
      })
  }, [tableId])

  function handleQuantityChange(menu: MenuItem, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) {
        const next = { ...prev }
        delete next[menu.id]
        return next
      }
      return { ...prev, [menu.id]: { menu, quantity } }
    })
  }

  function openCart() {
    setCartSheetKey((k) => k + 1)
    setIsCartOpen(true)
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-muted">세션을 연결하는 중입니다...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <p className="text-center text-red-600">{errorMessage}</p>
      </div>
    )
  }

  if (view === 'orders') {
    return <OrderStatusPage seat={seat} onBack={() => setView('menu')} />
  }

  const cartEntries = Object.values(cart)
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0)
  const cartTotal = cartEntries.reduce((sum, entry) => sum + entry.menu.price * entry.quantity, 0)

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="flex items-center justify-between bg-white px-4 py-2 shadow-sm">
        <img src="/logo.png" alt="온다스시" className="h-20 w-auto object-contain" />
        <button
          type="button"
          onClick={() => setView('orders')}
          className="rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          주문 현황
        </button>
      </header>
      <MenuListPage
        cartQuantities={Object.fromEntries(Object.entries(cart).map(([id, entry]) => [id, entry.quantity]))}
        onQuantityChange={handleQuantityChange}
      />

      <button
        type="button"
        onClick={openCart}
        className={`fixed bottom-0 left-0 right-0 flex items-center justify-between bg-primary-500 px-5 py-4 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] transition-transform duration-300 ${
          cartCount > 0 ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <span className="text-base font-semibold">장바구니 {cartCount}개</span>
        <span className="text-lg font-bold">{cartTotal.toLocaleString()}원</span>
      </button>

      <div
        className={`fixed inset-0 z-20 transition-opacity duration-300 ${
          isCartOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setIsCartOpen(false)} />
        <div
          className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-surface transition-transform duration-300 ${
            isCartOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <CartPage
            key={cartSheetKey}
            entries={cartEntries}
            onQuantityChange={handleQuantityChange}
            onBack={() => setIsCartOpen(false)}
            onOrderComplete={() => {
              setCart({})
              setIsCartOpen(false)
            }}
            onViewOrders={() => {
              setCart({})
              setIsCartOpen(false)
              setView('orders')
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default OrderEntryPage
