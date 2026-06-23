import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { createSession, getSessionByToken, type TableSessionResponse } from '../../customer/sessionApi'
import { getSessionToken, setSessionToken } from '../../customer/session'
import { formatSeatLabel, type SeatType } from '../../customer/seat'
import type { MenuItem } from '../../customer/menuApi'
import MenuListPage from './MenuListPage'
import CartPage, { type CartEntry } from './CartPage'

type Status = 'loading' | 'ready' | 'error'
type View = 'menu' | 'cart'

function OrderEntryPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [seat, setSeat] = useState<{ seatType: SeatType; tableNumber: number } | null>(null)
  const [view, setView] = useState<View>('menu')
  const [cart, setCart] = useState<Record<number, CartEntry>>({})
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

  const cartEntries = Object.values(cart)
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0)
  const cartTotal = cartEntries.reduce((sum, entry) => sum + entry.menu.price * entry.quantity, 0)

  if (view === 'cart') {
    return (
      <CartPage
        entries={cartEntries}
        onQuantityChange={handleQuantityChange}
        onBack={() => setView('menu')}
        onOrderComplete={() => {
          setCart({})
          setView('menu')
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="bg-primary-500 px-4 py-5 text-white">
        {seat && <p className="text-sm font-medium text-primary-50">{formatSeatLabel(seat.seatType, seat.tableNumber)}</p>}
        <h1 className="text-xl font-bold">오늘 뭐 드실래요?</h1>
      </header>
      <MenuListPage
        cartQuantities={Object.fromEntries(Object.entries(cart).map(([id, entry]) => [id, entry.quantity]))}
        onQuantityChange={handleQuantityChange}
      />

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setView('cart')}
          className="fixed bottom-0 left-0 right-0 flex items-center justify-between bg-primary-500 px-5 py-4 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)]"
        >
          <span className="text-sm font-medium">장바구니 {cartCount}개</span>
          <span className="text-base font-bold">{cartTotal.toLocaleString()}원</span>
        </button>
      )}
    </div>
  )
}

export default OrderEntryPage
