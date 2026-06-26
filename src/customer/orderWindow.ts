import { useEffect, useState } from 'react'

const OPEN = { hour: 0, minute: 0 } // TODO: 테스트 완료 후 { hour: 11, minute: 50 } 으로 복원
const WARNING = { hour: 21, minute: 10 }
const CLOSE = { hour: 21, minute: 20 }

export type OrderWindowState =
  | { status: 'before-open'; remainingMs: number }
  | { status: 'closing-soon'; remainingMs: number }
  | { status: 'open' }
  | { status: 'closed' }

function atTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base)
  d.setHours(hour, minute, 0, 0)
  return d
}

export function getOrderWindowState(now: Date = new Date()): OrderWindowState {
  const open = atTime(now, OPEN.hour, OPEN.minute)
  const warn = atTime(now, WARNING.hour, WARNING.minute)
  const close = atTime(now, CLOSE.hour, CLOSE.minute)

  if (now < open) return { status: 'before-open', remainingMs: open.getTime() - now.getTime() }
  if (now >= close) return { status: 'closed' }
  if (now >= warn) return { status: 'closing-soon', remainingMs: close.getTime() - now.getTime() }
  return { status: 'open' }
}

export function useOrderWindow(): OrderWindowState {
  const [state, setState] = useState<OrderWindowState>(() => getOrderWindowState())

  useEffect(() => {
    const interval = setInterval(() => setState(getOrderWindowState()), 1000)
    return () => clearInterval(interval)
  }, [])

  return state
}

/** mm:ss 형태 — 마감 직전 카운트다운용 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "1시간 20분" 형태 — 오픈 전 대기 시간 안내용 */
export function formatWaitTime(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}
