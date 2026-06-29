import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { StaffHeader } from '../../components/StaffHeader'
import {
  activateStaff,
  changeStaffPassword,
  changeStaffRole,
  createStaff,
  deactivateStaff,
  listAllStaff,
  type StaffMember,
} from '../../api/staff/admin/staffApi'
import { getStaffAuth } from '../../api/staff/auth'
import type { StaffRole } from '../../api/staff/auth'

type Status = 'loading' | 'ready' | 'error'
type ModalState =
  | { type: 'new' }
  | { type: 'role'; staff: StaffMember }
  | { type: 'password'; staff: StaffMember }
  | null

const inputCls =
  'w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400'

const ROLE_LABEL: Record<StaffRole, string> = {
  STAFF: '직원',
  ADMIN: '관리자',
}

const ROLE_BADGE: Record<StaffRole, string> = {
  STAFF: 'bg-primary-100 text-primary-700',
  ADMIN: 'bg-accent-400/20 text-amber-700',
}

// ── 신규 직원 생성 모달 ──────────────────────────────────────────────────────
function CreateModal({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (staff: StaffMember) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('STAFF')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해주세요.')
      return
    }
    setSaving(true)
    setError('')
    createStaff({ username: username.trim(), password: password.trim(), role })
      .then(onSave)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.')
        setSaving(false)
      })
  }

  return (
    <ModalShell title="직원 계정 추가" onCancel={onCancel}>
      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">아이디</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="로그인 아이디"
            autoFocus
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="초기 비밀번호"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">권한</label>
          <div className="flex gap-2">
            {(['STAFF', 'ADMIN'] as StaffRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  role === r
                    ? 'bg-primary-500 text-white'
                    : 'bg-ink/8 text-ink'
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ModalButtons onCancel={onCancel} onConfirm={handleSubmit} saving={saving} />
    </ModalShell>
  )
}

// ── 역할 변경 모달 ───────────────────────────────────────────────────────────
function RoleModal({
  staff,
  onCancel,
  onSave,
}: {
  staff: StaffMember
  onCancel: () => void
  onSave: (updated: StaffMember) => void
}) {
  const [role, setRole] = useState<StaffRole>(staff.role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit() {
    if (role === staff.role) { onCancel(); return }
    setSaving(true)
    changeStaffRole(staff.id, role)
      .then(() => onSave({ ...staff, role }))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : '변경에 실패했습니다.')
        setSaving(false)
      })
  }

  return (
    <ModalShell title={`권한 변경 — ${staff.username}`} onCancel={onCancel}>
      <div className="flex gap-2">
        {(['STAFF', 'ADMIN'] as StaffRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              role === r ? 'bg-primary-500 text-white' : 'bg-ink/8 text-ink'
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ModalButtons onCancel={onCancel} onConfirm={handleSubmit} saving={saving} />
    </ModalShell>
  )
}

// ── 비밀번호 초기화 모달 ─────────────────────────────────────────────────────
function PasswordModal({
  staff,
  onCancel,
  onDone,
}: {
  staff: StaffMember
  onCancel: () => void
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!password.trim()) {
      setError('새 비밀번호를 입력해주세요.')
      return
    }
    setSaving(true)
    changeStaffPassword(staff.id, password.trim())
      .then(onDone)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : '변경에 실패했습니다.')
        setSaving(false)
      })
  }

  return (
    <ModalShell title={`비밀번호 초기화 — ${staff.username}`} onCancel={onCancel}>
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted">새 비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="새 비밀번호 입력"
          autoFocus
          className={inputCls}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ModalButtons onCancel={onCancel} onConfirm={handleSubmit} saving={saving} confirmLabel="초기화" />
    </ModalShell>
  )
}

// ── 공통 모달 껍데기 ─────────────────────────────────────────────────────────
function ModalShell({
  title,
  onCancel,
  children,
}: {
  title: string
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-surface-raised p-6 shadow-2xl sm:rounded-3xl">
        <h2 className="mb-4 text-lg font-bold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ModalButtons({
  onCancel,
  onConfirm,
  saving,
  confirmLabel = '저장',
}: {
  onCancel: () => void
  onConfirm: () => void
  saving: boolean
  confirmLabel?: string
}) {
  return (
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
        onClick={onConfirm}
        className="flex-1 rounded-full bg-primary-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? '처리 중...' : confirmLabel}
      </button>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
function StaffManagePage({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [modal, setModal] = useState<ModalState>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const myUsername = getStaffAuth()?.username

  useEffect(() => {
    const auth = getStaffAuth()
    if (!onClose && (!auth || auth.role !== 'ADMIN')) {
      navigate('/staff')
      return
    }
    listAllStaff()
      .then((result) => {
        setStaffList(sortStaff(result))
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '직원 목록을 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [navigate])

  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(''), 3000)
    return () => clearTimeout(t)
  }, [actionError])

  function sortStaff(list: StaffMember[]): StaffMember[] {
    return [...list].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      if (a.role !== b.role) return a.role === 'ADMIN' ? -1 : 1
      return a.username.localeCompare(b.username)
    })
  }

  function handleCreated(staff: StaffMember) {
    setStaffList((prev) => sortStaff([...prev, staff]))
    setModal(null)
  }

  function handleUpdated(updated: StaffMember) {
    setStaffList((prev) => sortStaff(prev.map((s) => (s.id === updated.id ? updated : s))))
    setModal(null)
  }

  function handleToggleActive(staff: StaffMember) {
    if (staff.username === myUsername) {
      setActionError('본인 계정은 비활성화할 수 없습니다.')
      return
    }
    setProcessingId(staff.id)
    const req = staff.active ? deactivateStaff(staff.id) : activateStaff(staff.id)
    req
      .then(() =>
        setStaffList((prev) =>
          sortStaff(prev.map((s) => (s.id === staff.id ? { ...s, active: !s.active } : s))),
        ),
      )
      .catch((err: unknown) =>
        setActionError(err instanceof ApiError ? err.message : '처리에 실패했습니다.'),
      )
      .finally(() => setProcessingId(null))
  }

  return (
    <div className={onClose ? 'h-full overflow-auto bg-surface' : 'min-h-screen bg-surface'}>
      <StaffHeader title="직원 계정 관리" onClose={onClose} />

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

        {status === 'ready' && staffList.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted">등록된 직원 계정이 없습니다.</p>
            <button
              type="button"
              onClick={() => setModal({ type: 'new' })}
              className="mt-4 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white"
            >
              첫 계정 추가하기
            </button>
          </div>
        )}

        {status === 'ready' && staffList.length > 0 && (
          <ul className="grid gap-2">
            {staffList.map((staff) => {
              const busy = processingId === staff.id
              const isSelf = staff.username === myUsername
              return (
                <li
                  key={staff.id}
                  className={`rounded-card bg-surface-raised p-4 shadow-sm ${!staff.active ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* 정보 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink">{staff.username}</span>
                        {isSelf && (
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-600">
                            나
                          </span>
                        )}
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_BADGE[staff.role]}`}>
                          {ROLE_LABEL[staff.role]}
                        </span>
                        {staff.onDuty && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
                            근무 중
                          </span>
                        )}
                        {!staff.active && (
                          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-muted">
                            비활성
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 액션 */}
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'role', staff })}
                        className="rounded-full bg-ink/8 px-2.5 py-1.5 text-xs font-semibold text-ink"
                      >
                        권한
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'password', staff })}
                        className="rounded-full bg-ink/8 px-2.5 py-1.5 text-xs font-semibold text-ink"
                      >
                        비번
                      </button>
                      <button
                        type="button"
                        disabled={busy || isSelf}
                        onClick={() => handleToggleActive(staff)}
                        className={`rounded-full px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                          staff.active ? 'bg-red-50 text-red-600' : 'bg-primary-500 text-white'
                        }`}
                      >
                        {busy ? '...' : staff.active ? '비활성화' : '활성화'}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setModal({ type: 'new' })}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-2xl text-white shadow-lg transition-transform active:scale-90"
        aria-label="직원 추가"
      >
        +
      </button>

      {modal?.type === 'new' && (
        <CreateModal onCancel={() => setModal(null)} onSave={handleCreated} />
      )}
      {modal?.type === 'role' && (
        <RoleModal staff={modal.staff} onCancel={() => setModal(null)} onSave={handleUpdated} />
      )}
      {modal?.type === 'password' && (
        <PasswordModal staff={modal.staff} onCancel={() => setModal(null)} onDone={() => setModal(null)} />
      )}
    </div>
  )
}

export default StaffManagePage
