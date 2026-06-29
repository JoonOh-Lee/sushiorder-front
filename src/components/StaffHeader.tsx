import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearStaffAuth, getStaffAuth, updateStaffAuthOnDuty, updateStaffAuthStationId } from '../api/staff/auth'
import { assignMyStation, listStations, setMyDuty, type Station } from '../api/staff/stationApi'

const ROLE_LABEL = { STAFF: '직원', ADMIN: '관리자' }

interface StaffHeaderProps {
  title?: string
}

export function StaffHeader({ title }: StaffHeaderProps) {
  const navigate = useNavigate()
  const auth = getStaffAuth()
  const [onDuty, setOnDutyState] = useState(auth?.onDuty ?? false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showStationMenu, setShowStationMenu] = useState(false)
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    listStations().then(setStations).catch(() => {})
  }, [])

  function stationName(id: number | null): string {
    if (id === null) return '미지정'
    return stations.find((s) => s.id === id)?.name ?? `#${id}`
  }

  function closeAll() {
    setShowUserMenu(false)
    setShowStationMenu(false)
    setShowAdminMenu(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleToggleDuty() {
    if (!auth) return
    const next = !onDuty
    setMyDuty(next)
      .then(() => {
        setOnDutyState(next)
        updateStaffAuthOnDuty(next)
        setShowUserMenu(false)
        showToast(next ? '근무를 시작했습니다.' : '근무를 종료했습니다.')
      })
      .catch(() => {})
  }

  function handleAssignStation(stationId: number) {
    setAssigningId(stationId)
    assignMyStation(stationId)
      .then(() => {
        updateStaffAuthStationId(stationId)
        setShowStationMenu(false)
        navigate(0)
      })
      .catch(() => setAssigningId(null))
  }

  function handleLogout() {
    clearStaffAuth()
    navigate('/staff/login')
  }

  if (!auth) return null

  // 뱃지 공통 스타일 — 스테이션 뱃지와 동일한 크기
  const badgeCls = 'rounded-lg px-2 py-1 text-[11px] font-semibold leading-tight'

  return (
    <header className="relative flex shrink-0 items-center justify-between bg-primary-500 px-4 py-2.5 text-white">
      {/* 토스트 */}
      {toast && (
        <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-full bg-ink/80 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* 아바타 — 클릭 시 계정 정보 레이어 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowUserMenu((p) => !p); setShowStationMenu(false); setShowAdminMenu(false) }}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-colors active:opacity-75 ${
              onDuty ? 'bg-accent-400 text-ink' : 'bg-white/25 text-white/70'
            }`}
          >
            {auth.username.charAt(0).toUpperCase()}
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute left-0 top-9 z-20 w-52 overflow-hidden rounded-xl bg-surface-raised text-ink shadow-lg">
                <div className="px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">계정 정보</p>
                  <p className="mt-2 text-base font-bold text-ink">{auth.username}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600">
                      {ROLE_LABEL[auth.role]}
                    </span>
                    <span className="rounded-full bg-ink/8 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {stationName(auth.stationId)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      onDuty ? 'bg-accent-400/20 text-accent-600' : 'bg-ink/8 text-muted'
                    }`}>
                      {onDuty ? '근무 중' : '비근무'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ON/OFF 뱃지 — 클릭 시 즉시 근무 토글 */}
        <button
          type="button"
          onClick={handleToggleDuty}
          className={`${badgeCls} transition-colors active:opacity-75 ${
            onDuty ? 'bg-accent-400 text-ink' : 'bg-white/10 text-white/50'
          }`}
        >
          {onDuty ? 'ON' : 'OFF'}
        </button>

        {/* 스테이션 뱃지 — 클릭 시 스테이션 목록 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowStationMenu((p) => !p); setShowUserMenu(false); setShowAdminMenu(false) }}
            className={`${badgeCls} flex items-center gap-1 bg-white/15 text-white/90 transition-colors hover:bg-white/25 active:bg-white/30`}
          >
            {stationName(auth.stationId)}
            <span className={`text-[10px] opacity-60 transition-transform duration-150 ${showStationMenu ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>

          {showStationMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStationMenu(false)} />
              <div className="absolute left-0 top-10 z-20 w-48 overflow-hidden rounded-xl bg-surface-raised text-ink shadow-lg">
                <p className="px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  스테이션 변경
                </p>
                {stations.filter((s) => s.active).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={assigningId !== null}
                    onClick={() => handleAssignStation(s.id)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-primary-50 disabled:opacity-40 ${
                      s.id === auth.stationId ? 'font-bold text-primary-600' : 'font-medium'
                    }`}
                  >
                    <span>{s.name}</span>
                    {s.id === auth.stationId && <span className="text-xs text-primary-400">현재</span>}
                    {assigningId === s.id && <span className="text-xs text-muted">변경중...</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 페이지 타이틀 */}
      {title && (
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-bold">{title}</h1>
      )}

      {/* ⚙ — ADMIN: 관리 메뉴 + 로그아웃 / STAFF: 로그아웃만 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowAdminMenu((p) => !p); setShowUserMenu(false); setShowStationMenu(false) }}
          aria-label="메뉴"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base transition-transform active:scale-90"
        >
          ⚙
        </button>
        {showAdminMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowAdminMenu(false)} />
            <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl bg-surface-raised text-ink shadow-lg">
              {auth.role === 'ADMIN' && (
                <>
                  <p className="px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-muted">관리자</p>
                  {[
                    { label: '메뉴 관리', path: '/admin/menu' },
                    { label: '공지사항 관리', path: '/admin/notice' },
                    { label: '스테이션 관리', path: '/admin/station' },
                    { label: '직원 계정 관리', path: '/admin/staff' },
                    { label: '매장 배치 설정', path: '/admin/table-layout' },
                  ].map(({ label, path }) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => { closeAll(); navigate(path) }}
                      className="block w-full px-4 py-3 text-left text-sm font-medium hover:bg-primary-50"
                    >
                      {label}
                    </button>
                  ))}
                  <div className="mx-4 border-t border-primary-100" />
                </>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
