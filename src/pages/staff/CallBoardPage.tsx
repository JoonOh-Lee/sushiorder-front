import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { getStaffAuth } from '../../auth/staffAuth'
import { listStaffCalls, resolveStaffCall, type CallType, type StaffCall } from '../../auth/staffCallApi'

type Status = 'loading' | 'ready' | 'error'

const POLL_INTERVAL_MS = 10_000

const TYPE_LABEL: Record<CallType, string> = {
  WATER_REFILL: '물 리필',
  INQUIRY: '문의',
  ITEM_REQUEST: '물품 요청',
  OTHER: '기타',
}

function CallBoardPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [calls, setCalls] = useState<StaffCall[]>([])
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  useEffect(() => {
    if (!getStaffAuth()) {
      navigate('/staff/login')
      return
    }

    let cancelled = false

    function load() {
      listStaffCalls()
        .then((result) => {
          if (cancelled) return
          setCalls([...result].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
          setStatus('ready')
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setErrorMessage(err instanceof ApiError ? err.message : '호출 목록을 불러오지 못했습니다.')
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

  function handleResolve(id: number) {
    setResolvingId(id)
    resolveStaffCall(id)
      .then(() => {
        setCalls((prev) => prev.filter((call) => call.id !== id))
        setResolvingId(null)
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '호출 처리에 실패했습니다.')
        setResolvingId(null)
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
        <h1 className="text-xl font-bold">호출 현황</h1>
      </header>

      <div className="px-4 py-4">
        {status === 'loading' && <p className="py-10 text-center text-muted">불러오는 중입니다...</p>}
        {status === 'error' && <p className="py-10 text-center text-red-600">{errorMessage}</p>}
        {status === 'ready' && calls.length === 0 && (
          <p className="py-10 text-center text-muted">처리할 호출이 없습니다.</p>
        )}
        {status === 'ready' && calls.length > 0 && (
          <ul className="grid gap-3">
            {calls.map((call) => (
              <li
                key={call.id}
                className="flex items-center justify-between gap-3 rounded-card bg-surface-raised p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-accent-400 px-2.5 py-1 text-xs font-semibold text-white">
                      테이블 {call.tableId}
                    </span>
                    <span className="text-sm text-muted">
                      {new Date(call.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-lg font-bold text-ink">
                    {TYPE_LABEL[call.type]}
                    {call.itemName && ` · ${call.itemName}`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={resolvingId === call.id}
                  onClick={() => handleResolve(call.id)}
                  className="shrink-0 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  {resolvingId === call.id ? '처리 중...' : '처리완료'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default CallBoardPage
