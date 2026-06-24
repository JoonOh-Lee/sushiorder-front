import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { listStations, assignMyStation, type Station } from '../../auth/stationApi'
import { getStaffAuth, updateStaffAuthStationId } from '../../auth/staffAuth'

type Status = 'loading' | 'ready' | 'error'

function StationSelectPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [assigningId, setAssigningId] = useState<number | null>(null)

  useEffect(() => {
    if (!getStaffAuth()) {
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
  }, [navigate])

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
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-muted">스테이션 목록을 불러오는 중입니다...</p>
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

  return (
    <div className="min-h-screen bg-surface px-4 py-6">
      <h1 className="text-xl font-bold text-ink">담당 스테이션을 선택해주세요</h1>
      <p className="mt-1 text-sm text-muted">오늘 근무하실 스테이션을 골라주세요.</p>

      {errorMessage && <p className="mt-3 text-center text-sm text-red-600">{errorMessage}</p>}

      <div className="mt-5 grid gap-2.5">
        {stations.map((station) => (
          <button
            key={station.id}
            type="button"
            disabled={assigningId !== null}
            onClick={() => handleSelect(station.id)}
            className="rounded-xl bg-surface-raised px-4 py-3.5 text-left text-base font-semibold text-ink shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {assigningId === station.id ? '지정 중...' : station.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default StationSelectPage
