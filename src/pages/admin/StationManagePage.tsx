import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { StaffHeader } from '../../components/StaffHeader'
import {
  activateStation,
  createStation,
  deactivateStation,
  listAllStations,
  renameStation,
  reorderStations,
} from '../../api/staff/admin/stationApi'
import { getStaffAuth } from '../../api/staff/auth'
import type { Station } from '../../api/staff/stationApi'

type Status = 'loading' | 'ready' | 'error'

const inputCls =
  'w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400'

interface NameModalProps {
  station: Station | null
  onCancel: () => void
  onSave: (result: Station | { name: string }) => void
}

function NameModal({ station, onCancel, onSave }: NameModalProps) {
  const [name, setName] = useState(station?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('스테이션 이름을 입력해주세요.')
      return
    }
    setSaving(true)
    setError('')

    if (station) {
      renameStation(station.id, trimmed)
        .then(() => onSave({ ...station, name: trimmed }))
        .catch((err: unknown) => {
          setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.')
          setSaving(false)
        })
    } else {
      createStation(trimmed)
        .then((created) => onSave(created))
        .catch((err: unknown) => {
          setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.')
          setSaving(false)
        })
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-surface-raised p-6 shadow-2xl sm:rounded-3xl">
        <h2 className="text-lg font-bold text-ink">
          {station ? '스테이션 이름 변경' : '스테이션 추가'}
        </h2>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-muted">이름</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="예: 초밥 스테이션"
            autoFocus
            className={inputCls}
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/10 py-3 text-sm font-semibold text-ink"
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="flex-1 rounded-full bg-primary-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StationManagePage({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [editTarget, setEditTarget] = useState<Station | null | 'new'>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const auth = getStaffAuth()
    if (!onClose && (!auth || auth.role !== 'ADMIN')) {
      navigate('/staff')
      return
    }
    listAllStations()
      .then((result) => {
        setStations(sortByOrder(result))
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '스테이션을 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [navigate])

  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(''), 3000)
    return () => clearTimeout(t)
  }, [actionError])

  function sortByOrder(list: Station[]): Station[] {
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function handleSaved(result: Station | { name: string }) {
    if ('id' in result) {
      // 생성 또는 이름 변경 결과
      setStations((prev) => {
        const exists = prev.find((s) => s.id === result.id)
        return exists
          ? sortByOrder(prev.map((s) => (s.id === result.id ? result : s)))
          : sortByOrder([...prev, result])
      })
    }
    setEditTarget(null)
  }

  function handleToggleActive(station: Station) {
    setProcessingId(station.id)
    const req = station.active ? deactivateStation(station.id) : activateStation(station.id)
    req
      .then(() =>
        setStations((prev) =>
          prev.map((s) => (s.id === station.id ? { ...s, active: !s.active } : s)),
        ),
      )
      .catch((err: unknown) =>
        setActionError(err instanceof ApiError ? err.message : '처리에 실패했습니다.'),
      )
      .finally(() => setProcessingId(null))
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...stations]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    const reordered = next.map((s, i) => ({ ...s, sortOrder: i + 1 }))
    setStations(reordered)
    setReordering(true)
    reorderStations(reordered.map((s) => ({ stationId: s.id, sortOrder: s.sortOrder })))
      .catch((err: unknown) =>
        setActionError(err instanceof ApiError ? err.message : '순서 변경에 실패했습니다.'),
      )
      .finally(() => setReordering(false))
  }

  return (
    <div className={onClose ? 'h-full overflow-auto bg-surface' : 'min-h-screen bg-surface'}>
      <StaffHeader title="스테이션 관리" onClose={onClose} />

      {actionError && (
        <p className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">{actionError}</p>
      )}

      <div className="mx-auto max-w-3xl px-4 py-4">
        {status === 'loading' && (
          <p className="py-12 text-center text-muted">불러오는 중입니다...</p>
        )}
        {status === 'error' && (
          <p className="py-12 text-center text-red-600">{errorMessage}</p>
        )}

        {status === 'ready' && stations.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted">등록된 스테이션이 없습니다.</p>
            <button
              type="button"
              onClick={() => setEditTarget('new')}
              className="mt-4 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white"
            >
              첫 스테이션 추가하기
            </button>
          </div>
        )}

        {status === 'ready' && stations.length > 0 && (
          <>
            <p className="mb-3 text-xs text-muted">
              ↑↓ 버튼으로 순서를 변경하면 직원 스테이션 선택 화면에 반영됩니다.
            </p>
            <ul className="grid gap-2">
              {stations.map((station, index) => {
                const busy = processingId === station.id
                return (
                  <li
                    key={station.id}
                    className={`flex items-center gap-3 rounded-card bg-surface-raised px-4 py-3 shadow-sm ${!station.active ? 'opacity-50' : ''}`}
                  >
                    {/* 순서 버튼 */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0 || reordering}
                        onClick={() => move(index, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded text-sm text-muted transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:opacity-20"
                        aria-label="위로"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === stations.length - 1 || reordering}
                        onClick={() => move(index, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded text-sm text-muted transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:opacity-20"
                        aria-label="아래로"
                      >
                        ▼
                      </button>
                    </div>

                    {/* 정보 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink">{station.name}</span>
                        {station.hasOnDutyStaff && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
                            근무 중
                          </span>
                        )}
                        {!station.active && (
                          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-muted">
                            비활성
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">순서 {station.sortOrder}</p>
                    </div>

                    {/* 액션 */}
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditTarget(station)}
                        className="rounded-full bg-ink/8 px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
                      >
                        이름
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(station)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                          station.active
                            ? 'bg-red-50 text-red-600'
                            : 'bg-primary-500 text-white'
                        }`}
                      >
                        {busy ? '...' : station.active ? '비활성화' : '활성화'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setEditTarget('new')}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gray-700 text-2xl text-white shadow-lg transition-transform active:scale-90"
        aria-label="스테이션 추가"
      >
        +
      </button>

      {editTarget !== null && (
        <NameModal
          station={editTarget === 'new' ? null : editTarget}
          onCancel={() => setEditTarget(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}

export default StationManagePage
