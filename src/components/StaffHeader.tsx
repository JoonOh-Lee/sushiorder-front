import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearStaffAuth, getStaffAuth, updateStaffAuthOnDuty, updateStaffAuthStationId } from '../api/staff/auth'
import { assignMyStation, listStations, setMyDuty, type Station } from '../api/staff/stationApi'
import { ApiError } from '../api/types'

export type AdminPanelKey = 'menu' | 'notice' | 'station' | 'staff' | 'table-layout' | 'audit-log'

const ROLE_LABEL = { STAFF: '직원', ADMIN: '관리자' }

const ADMIN_ITEMS: { label: string; key: AdminPanelKey; path: string }[] = [
  { label: '메뉴 관리', key: 'menu', path: '/admin/menu' },
  { label: '공지사항 관리', key: 'notice', path: '/admin/notice' },
  { label: '스테이션 관리', key: 'station', path: '/admin/station' },
  { label: '직원 계정 관리', key: 'staff', path: '/admin/staff' },
  { label: '매장 배치 설정', key: 'table-layout', path: '/admin/table-layout' },
  { label: '감사 로그', key: 'audit-log', path: '/admin/audit-log' },
]

interface StaffHeaderProps {
  title?: string
  /** 패널 모드: ← 현황판 닫기 버튼 표시 */
  onClose?: () => void
  /** 현황판 모드: 관리 메뉴 클릭 시 navigate 대신 패널 열기 */
  onOpenPanel?: (key: AdminPanelKey) => void
}

export function StaffHeader({ title, onClose, onOpenPanel }: StaffHeaderProps) {
  const navigate = useNavigate()
  const auth = getStaffAuth()
  const [onDuty, setOnDutyState] = useState(auth?.onDuty ?? false)
  const [showStationMenu, setShowStationMenu] = useState(false)
  const [showMainMenu, setShowMainMenu] = useState(false)
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
    setShowStationMenu(false)
    setShowMainMenu(false)
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
        setShowMainMenu(false)
        showToast(next ? '근무를 시작했습니다.' : '근무를 종료했습니다.')
      })
      .catch((err: unknown) => {
        showToast(err instanceof ApiError ? err.message : '근무 상태 변경에 실패했습니다.')
      })
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

  return (
    <header
      className={`relative flex shrink-0 items-center justify-between px-4 py-2.5 text-white transition-colors duration-500 ${
        onDuty ? 'bg-primary-500' : 'bg-gray-500'
      }`}
    >
      {/* 토스트 */}
      {toast && (
        <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-full bg-ink/80 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 왼쪽: 패널 모드 = 닫기 버튼 / 현황판 모드 = 스테이션 뱃지 */}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white/90 transition-colors hover:bg-white/25 active:bg-white/30"
        >
          ← 현황판
        </button>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowStationMenu((p) => !p); setShowMainMenu(false) }}
            className="flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white/90 transition-colors hover:bg-white/25 active:bg-white/30"
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
      )}

      {/* 페이지 타이틀 */}
      {title && (
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-bold">{title}</h1>
      )}

      {/* 아바타 + 메뉴 버튼 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowMainMenu((p) => !p); setShowStationMenu(false) }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold transition-colors hover:bg-white/30 active:scale-90"
          aria-label="메뉴"
        >
          {auth.username.charAt(0).toUpperCase()}
        </button>

        {showMainMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMainMenu(false)} />
            <div className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-xl bg-surface-raised text-ink shadow-lg">
              {/* 계정 정보 */}
              <div className="border-b border-primary-100 px-4 py-3">
                <p className="font-bold text-ink">{auth.username}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {ROLE_LABEL[auth.role]} · {stationName(auth.stationId)}
                </p>
              </div>

              {/* 근무 토글 */}
              <button
                type="button"
                onClick={handleToggleDuty}
                className={`flex w-full items-center justify-between px-4 py-3 text-sm font-semibold ${
                  onDuty ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                }`}
              >
                <span>{onDuty ? '근무 종료' : '근무 시작'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  onDuty ? 'bg-primary-50 text-primary-600' : 'bg-ink/8 text-muted'
                }`}>
                  {onDuty ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* 관리자 메뉴 (패널 모드에서는 숨김) */}
              {auth.role === 'ADMIN' && !onClose && (
                <>
                  <div className="border-t border-primary-100" />
                  <p className="px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-muted">관리자</p>
                  {ADMIN_ITEMS.map(({ label, key, path }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        closeAll()
                        if (onOpenPanel) {
                          onOpenPanel(key)
                        } else {
                          navigate(path)
                        }
                      }}
                      className="block w-full px-4 py-3 text-left text-sm font-medium hover:bg-primary-50"
                    >
                      {label}
                    </button>
                  ))}
                </>
              )}

              {/* 로그아웃 */}
              <div className="border-t border-primary-100" />
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
