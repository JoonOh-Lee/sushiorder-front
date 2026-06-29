import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import {
  activateNotice,
  createNotice,
  deactivateNotice,
  listAllNotices,
  pinNotice,
  unpinNotice,
  updateNotice,
  type NoticeInput,
} from '../../api/staff/admin/noticeApi'
import { getStaffAuth } from '../../api/staff/auth'
import type { Notice } from '../../customer/noticeApi'
import { formatTime } from '../../utils/format'

type Status = 'loading' | 'ready' | 'error'

const inputCls =
  'w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400'

interface NoticeFormModalProps {
  notice: Notice | null
  onCancel: () => void
  onSave: (notice: Notice) => void
}

function NoticeFormModal({ notice, onCancel, onSave }: NoticeFormModalProps) {
  const [title, setTitle] = useState(notice?.title ?? '')
  const [content, setContent] = useState(notice?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.')
      return
    }
    const input: NoticeInput = { title: title.trim(), content: content.trim() }
    setSaving(true)
    setError('')
    const req = notice ? updateNotice(notice.id, input) : createNotice(input)
    req
      .then((saved) => onSave(saved))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.')
        setSaving(false)
      })
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-surface-raised p-6 shadow-2xl sm:rounded-3xl">
        <h2 className="text-lg font-bold text-ink">{notice ? '공지 수정' : '공지 추가'}</h2>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지 제목"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지 내용을 입력하세요"
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>
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

function NoticeManagePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const [editTarget, setEditTarget] = useState<Notice | null | 'new'>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const auth = getStaffAuth()
    if (!auth || auth.role !== 'ADMIN') {
      navigate('/staff')
      return
    }
    listAllNotices()
      .then((result) => {
        setNotices(sortNotices(result))
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '공지사항을 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [navigate])

  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(''), 3000)
    return () => clearTimeout(t)
  }, [actionError])

  function sortNotices(list: Notice[]): Notice[] {
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.createdAt.localeCompare(a.createdAt)
    })
  }

  function handleSaved(saved: Notice) {
    setNotices((prev) => {
      const exists = prev.find((n) => n.id === saved.id)
      const next = exists
        ? prev.map((n) => (n.id === saved.id ? saved : n))
        : [...prev, saved]
      return sortNotices(next)
    })
    setEditTarget(null)
  }

  function handleTogglePin(notice: Notice) {
    setProcessingId(notice.id)
    const req = notice.pinned ? unpinNotice(notice.id) : pinNotice(notice.id)
    req
      .then((updated) =>
        setNotices((prev) => sortNotices(prev.map((n) => (n.id === updated.id ? updated : n)))),
      )
      .catch((err: unknown) => setActionError(err instanceof ApiError ? err.message : '처리에 실패했습니다.'))
      .finally(() => setProcessingId(null))
  }

  function handleToggleActive(notice: Notice) {
    setProcessingId(notice.id)
    const req = notice.active ? deactivateNotice(notice.id) : activateNotice(notice.id)
    req
      .then((updated) =>
        setNotices((prev) => sortNotices(prev.map((n) => (n.id === updated.id ? updated : n)))),
      )
      .catch((err: unknown) => setActionError(err instanceof ApiError ? err.message : '처리에 실패했습니다.'))
      .finally(() => setProcessingId(null))
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-primary-500 px-4 py-2.5 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/staff')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform active:scale-90"
          >
            ←
          </button>
          <h1 className="flex-1 text-xl font-bold">공지사항 관리</h1>
          <button
            type="button"
            onClick={() => setEditTarget('new')}
            className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold"
          >
            + 추가
          </button>
        </div>
      </header>

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

        {status === 'ready' && notices.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted">등록된 공지사항이 없습니다.</p>
            <button
              type="button"
              onClick={() => setEditTarget('new')}
              className="mt-4 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white"
            >
              첫 공지 등록하기
            </button>
          </div>
        )}

        {status === 'ready' && notices.length > 0 && (
          <ul className="grid gap-3">
            {notices.map((notice) => {
              const busy = processingId === notice.id
              return (
                <li
                  key={notice.id}
                  className={`rounded-card bg-surface-raised p-4 shadow-sm ${!notice.active ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {notice.pinned && (
                          <span className="shrink-0 rounded-full bg-primary-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                            고정
                          </span>
                        )}
                        {!notice.active && (
                          <span className="shrink-0 rounded-full bg-ink/15 px-2.5 py-0.5 text-[11px] font-bold text-muted">
                            비활성
                          </span>
                        )}
                        <h3 className="font-bold text-ink">{notice.title}</h3>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{notice.content}</p>
                      <p className="mt-2 text-xs text-muted/60">{formatTime(notice.createdAt)} 등록</p>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditTarget(notice)}
                      className="shrink-0 rounded-full bg-ink/8 px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
                    >
                      수정
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2 border-t border-primary-100 pt-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleTogglePin(notice)}
                      className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                        notice.pinned
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-ink/8 text-ink'
                      }`}
                    >
                      {busy ? '처리 중...' : notice.pinned ? '고정 해제' : '상단 고정'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleActive(notice)}
                      className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                        notice.active
                          ? 'bg-red-50 text-red-600'
                          : 'bg-primary-500 text-white'
                      }`}
                    >
                      {busy ? '처리 중...' : notice.active ? '비활성화' : '활성화'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {editTarget !== null && (
        <NoticeFormModal
          notice={editTarget === 'new' ? null : editTarget}
          onCancel={() => setEditTarget(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}

export default NoticeManagePage
