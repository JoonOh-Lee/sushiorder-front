import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearStaffAuth, getStaffAuth, type StaffAuth } from '../../auth/staffAuth'

const ROLE_LABEL: Record<StaffAuth['role'], string> = {
  STAFF: '직원',
  ADMIN: '관리자',
}

function StaffHomePage() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState<StaffAuth | null>(null)

  useEffect(() => {
    const current = getStaffAuth()
    if (!current) {
      navigate('/staff/login')
      return
    }
    setAuth(current)
  }, [navigate])

  function handleLogout() {
    clearStaffAuth()
    navigate('/staff/login')
  }

  if (!auth) return null

  return (
    <div className="flex min-h-screen flex-col bg-surface px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-ink">{auth.username}님 환영합니다</p>
          <p className="mt-1 text-sm text-muted">{ROLE_LABEL[auth.role]}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-600 transition-transform active:scale-95"
        >
          로그아웃
        </button>
      </div>

      <div className="mt-6 rounded-card bg-surface-raised p-4 shadow-sm">
        {auth.stationId === null ? (
          <p className="text-base font-semibold text-red-600">담당 스테이션이 지정되지 않았습니다.</p>
        ) : (
          <p className="text-base text-ink">담당 스테이션: {auth.stationId}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/staff/calls')}
        className="mt-3 rounded-card bg-primary-500 p-4 text-left text-base font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
      >
        호출 현황 보기
      </button>
    </div>
  )
}

export default StaffHomePage
