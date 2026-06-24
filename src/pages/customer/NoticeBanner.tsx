import { useEffect, useState } from 'react'
import { fetchNotices, type Notice } from '../../customer/noticeApi'

const ROTATE_INTERVAL_MS = 4000

function NoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [index, setIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchNotices()
      .then(setNotices)
      .catch(() => {
        // 공지는 화면 흐름을 막을 정도로 중요하지 않으니 실패하면 그냥 배너를 숨긴다.
      })
  }, [])

  useEffect(() => {
    if (notices.length < 2) return
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % notices.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [notices.length])

  if (notices.length === 0) return null

  const notice = notices[index]

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-3 overflow-hidden bg-primary-50 px-4 py-2.5 text-left"
      >
        <span className="shrink-0 rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-bold text-white">공지</span>
        <p key={notice.id} className="flex-1 truncate text-sm font-medium text-primary-700 animate-notice-fade">
          {notice.title}
        </p>
        {notices.length > 1 && (
          <span className="shrink-0 text-xs font-medium text-primary-400">
            {index + 1}/{notices.length}
          </span>
        )}
      </button>

      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
        <div
          className={`absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-surface-raised p-5 transition-transform duration-300 ${
            isOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <h2 className="text-xl font-bold text-ink">공지사항</h2>
          <ul className="mt-4 grid gap-4">
            {notices.map((n) => (
              <li key={n.id} className="rounded-xl bg-surface px-4 py-3">
                <div className="flex items-center gap-2">
                  {n.pinned && (
                    <span className="shrink-0 rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      고정
                    </span>
                  )}
                  <h3 className="font-bold text-ink">{n.title}</h3>
                </div>
                <p className="mt-1.5 text-sm text-muted">{n.content}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

export default NoticeBanner
