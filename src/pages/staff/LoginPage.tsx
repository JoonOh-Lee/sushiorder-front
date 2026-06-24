import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { login } from '../../auth/authApi'
import { setStaffAuth } from '../../auth/staffAuth'

type Status = 'idle' | 'submitting' | 'error'

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    login(username, password)
      .then((auth) => {
        setStaffAuth(auth)
        navigate(auth.stationId === null ? '/staff/station' : '/staff')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '로그인에 실패했습니다.')
        setStatus('error')
      })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-card bg-surface-raised p-6 shadow-sm">
        <h1 className="text-xl font-bold text-ink">직원 로그인</h1>

        <div className="mt-5 grid gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디"
            autoComplete="username"
            required
            className="w-full rounded-xl border border-primary-100 bg-surface px-4 py-3 text-base text-ink outline-none focus:border-primary-400"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-primary-100 bg-surface px-4 py-3 text-base text-ink outline-none focus:border-primary-400"
          />
        </div>

        {status === 'error' && <p className="mt-3 text-center text-sm text-red-600">{errorMessage}</p>}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="mt-5 w-full rounded-full bg-primary-500 py-3.5 text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {status === 'submitting' ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}

export default LoginPage
