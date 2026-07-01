import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { getOrderStats, type OrderStats } from '../../api/staff/admin/orderStatsApi'
import { getStaffAuth } from '../../api/staff/auth'
import { StaffHeader } from '../../components/StaffHeader'

type Status = 'loading' | 'ready' | 'error'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function OrderStatsPage({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [date, setDate] = useState(() => toDateString(new Date()))
  const [inputDate, setInputDate] = useState(() => toDateString(new Date()))

  useEffect(() => {
    const auth = getStaffAuth()
    if (!auth) { navigate('/staff/login'); return }
    if (!onClose && auth.role !== 'ADMIN') { navigate('/staff'); return }
    load(date)
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  function load(d: string) {
    setStatus('loading')
    setErrorMessage('')
    getOrderStats(d)
      .then((result) => { setStats(result); setStatus('ready') })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '통계를 불러오지 못했습니다.')
        setStatus('error')
      })
  }

  function handleSearch() {
    setDate(inputDate)
    load(inputDate)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  const hourly = stats?.hourlyDistribution ?? []
  const maxHourly = Math.max(...hourly, 1)
  const maxMenuQty = stats?.topMenus[0]?.quantity ?? 1

  const isToday = date === toDateString(new Date())

  return (
    <div className={`flex ${onClose ? 'h-full' : 'h-screen'} flex-col bg-surface`}>
      <StaffHeader title="매출 통계" onClose={onClose} />

      {/* 날짜 선택 */}
      <div className="shrink-0 border-b border-primary-100 bg-surface-raised px-4 py-3">
        <div className="flex gap-2">
          <input
            type="date"
            value={inputDate}
            max={toDateString(new Date())}
            onChange={(e) => setInputDate(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={status === 'loading'}
            className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
          >
            조회
          </button>
        </div>
        {isToday && (
          <p className="mt-1.5 text-[11px] text-muted">오늘 날짜 기준</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {status === 'loading' && (
          <p className="py-16 text-center text-muted">불러오는 중입니다...</p>
        )}
        {status === 'error' && (
          <p className="py-16 text-center text-sm text-red-600">{errorMessage}</p>
        )}

        {status === 'ready' && stats && (
          <div className="grid gap-4 p-4">

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-card bg-primary-50 p-4">
                <p className="text-xs font-semibold text-primary-500">총 주문</p>
                <p className="mt-1 text-2xl font-bold text-primary-700">
                  {stats.totalOrders.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-primary-400">건</span>
                </p>
              </div>
              <div className="rounded-card bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-600">총 매출</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">
                  {stats.totalRevenue.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-amber-400">원</span>
                </p>
              </div>
            </div>

            {stats.totalOrders === 0 ? (
              <p className="py-6 text-center text-sm text-muted">해당 날짜의 주문이 없습니다.</p>
            ) : (
              <>
                {/* 시간대별 주문 분포 */}
                <div className="rounded-card bg-surface-raised p-4">
                  <h2 className="mb-3 text-sm font-bold text-ink">시간대별 주문 분포</h2>
                  <div className="flex items-end gap-px" style={{ height: 72 }}>
                    {hourly.map((count, hour) => (
                      <div
                        key={hour}
                        title={`${hour}시: ${count}건`}
                        className={`flex-1 rounded-t-sm transition-all ${
                          count > 0 ? 'bg-primary-400' : 'bg-ink/8'
                        }`}
                        style={{ height: `${Math.max((count / maxHourly) * 72, count > 0 ? 3 : 0)}px` }}
                      />
                    ))}
                  </div>
                  {/* 시간 레이블: 0, 6, 12, 18 */}
                  <div className="mt-1.5 flex gap-px">
                    {hourly.map((_, hour) => (
                      <div key={hour} className="flex-1 text-center text-[9px] text-muted">
                        {hour % 6 === 0 ? hour : ''}
                      </div>
                    ))}
                  </div>
                  {/* 피크 시간 표시 */}
                  {maxHourly > 0 && (
                    <p className="mt-2 text-[11px] text-muted">
                      피크: {hourly.indexOf(maxHourly)}시 ({maxHourly}건)
                    </p>
                  )}
                </div>

                {/* 인기 메뉴 TOP 5 */}
                {stats.topMenus.length > 0 && (
                  <div className="rounded-card bg-surface-raised p-4">
                    <h2 className="mb-3 text-sm font-bold text-ink">
                      인기 메뉴 TOP {stats.topMenus.length}
                    </h2>
                    <ul className="grid gap-3">
                      {stats.topMenus.map((menu, idx) => (
                        <li key={menu.menuId}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  idx === 0
                                    ? 'bg-amber-400 text-white'
                                    : idx === 1
                                      ? 'bg-gray-300 text-gray-700'
                                      : idx === 2
                                        ? 'bg-amber-700/70 text-white'
                                        : 'bg-ink/10 text-muted'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className="font-medium text-ink">{menu.menuName}</span>
                            </span>
                            <span className="text-xs text-muted">
                              {menu.quantity}건 · {menu.revenue.toLocaleString()}원
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                            <div
                              className="h-full rounded-full bg-primary-400 transition-all"
                              style={{ width: `${(menu.quantity / maxMenuQty) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderStatsPage
