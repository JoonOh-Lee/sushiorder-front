import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { listStations, assignMyStation, type Station } from '../../auth/stationApi'
import { getStaffAuth, updateStaffAuthStationId, type StaffAuth } from '../../auth/staffAuth'

type Status = 'loading' | 'ready' | 'error'

const ROLE_LABEL: Record<StaffAuth['role'], string> = {
  STAFF: '직원',
  ADMIN: '관리자',
}

function StationSelectPage() {
  const navigate = useNavigate()
  const [auth] = useState<StaffAuth | null>(() => getStaffAuth())
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [assigningId, setAssigningId] = useState<number | null>(null)

  useEffect(() => {
    if (!auth) {
      navigate('/staff/login')
      return
    }

    listStations()
      .then((result) => {
        setStations(result)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '스테이션 목록을 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [auth, navigate])

  function handleSelect(stationId: number) {
    setAssigningId(stationId)
    assignMyStation(stationId)
      .then(() => {
        updateStaffAuthStationId(stationId)
        navigate('/staff')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '스테이션 지정에 실패했습니다.')
        setAssigningId(null)
      })
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <div className="bg-primary-500 px-4 py-5 text-white">
          <p className="text-xs text-white/60">{auth?.username} · {auth ? ROLE_LABEL[auth.role] : ''}</p>
          <h1 className="mt-0.5 text-lg font-bold">스테이션 선택</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <div className="bg-primary-500 px-4 py-5 text-white">
          <p className="text-xs text-white/60">{auth?.username} · {auth ? ROLE_LABEL[auth.role] : ''}</p>
          <h1 className="mt-0.5 text-lg font-bold">스테이션 선택</h1>
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-center text-sm text-red-600">{errorMessage}</p>
        </div>
      </div>
    )
  }

  const availableCount = stations.filter((s) => !s.hasOnDutyStaff).length

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="bg-primary-500 px-4 py-5 text-white">
        <p className="text-xs text-white/60">{auth?.username} · {auth ? ROLE_LABEL[auth.role] : ''}</p>
        <h1 className="mt-0.5 text-lg font-bold">스테이션 선택</h1>
        <p className="mt-0.5 text-xs text-white/60">
          {availableCount > 0 ? `${availableCount}개 선택 가능` : '현재 선택 가능한 스테이션이 없습니다'}
        </p>
      </div>

      <div className="flex-1 p-4">
        {errorMessage && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">{errorMessage}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {stations.map((station) => {
            const occupied = station.hasOnDutyStaff
            const isAssigning = assigningId === station.id

            return (
              <button
                key={station.id}
                type="button"
                disabled={assigningId !== null || occupied}
                onClick={() => handleSelect(station.id)}
                className={`relative flex min-h-[100px] flex-col justify-between rounded-2xl p-4 text-left shadow-sm transition-transform active:scale-[0.96] disabled:cursor-not-allowed ${
                  occupied
                    ? 'bg-ink/5'
                    : 'bg-surface-raised border border-primary-100 active:border-primary-300'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-base font-bold leading-snug ${occupied ? 'text-muted' : 'text-ink'}`}>
                    {isAssigning ? '지정 중…' : station.name}
                  </span>
                  {occupied && (
                    <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-600">
                      근무 중
                    </span>
                  )}
                </div>

                {!occupied && !isAssigning && (
                  <span className="mt-3 text-[11px] text-muted">탭하여 선택</span>
                )}
                {isAssigning && (
                  <span className="mt-3 text-[11px] text-primary-500">처리 중...</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default StationSelectPage
