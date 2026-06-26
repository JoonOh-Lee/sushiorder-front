import { useEffect, useState } from 'react'
import { fetchNotices, type Notice } from '../../customer/noticeApi'

const ROTATE_INTERVAL_MS = 4000

function NoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [index, setIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchNotices().then(setNotices).catch(() => {})
  }, [])

  useEffect(() => {
    if (notices.length < 2 || isOpen) return
    const interval = setInterval(() => setIndex((i) => (i + 1) % notices.length), ROTATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [notices.length, isOpen])

  if (notices.length === 0) return null

  const notice = notices[index]

  return (
    <div className="relative">
      {isOpen && <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center gap-3 overflow-hidden px-4 py-2.5 text-left transition-colors duration-200 ${
          isOpen ? 'bg-primary-100' : 'bg-primary-50'
        }`}
      >
        <span className="shrink-0 rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-bold text-white">공지</span>
        {isOpen ? (
          <p className="flex-1 text-sm font-semibold text-primary-700">공지사항</p>
        ) : (
          <p key={notice.id} className="flex-1 truncate text-sm font-medium text-primary-700 animate-notice-fade">
            {notice.title}
          </p>
        )}
        {!isOpen && notices.length > 1 && (
          <span className="shrink-0 text-xs font-medium text-primary-400">
            {index + 1}/{notices.length}
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`size-4 shrink-0 text-primary-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      <div
        className={`absolute left-0 right-0 top-full z-30 origin-top rounded-b-2xl bg-primary-50/95 shadow-2xl backdrop-blur-sm transition-all duration-300 ${
          isOpen ? 'scale-y-100 opacity-100' : 'pointer-events-none scale-y-0 opacity-0'
        }`}
      >
        <ul className="grid gap-2.5 p-4">
          {notices.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl px-4 py-3 shadow-sm ${
                n.pinned ? 'bg-primary-500' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {n.pinned && (
                  <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold text-white">
                    고정
                  </span>
                )}
                <h3 className={`font-bold ${n.pinned ? 'text-white' : 'text-ink'}`}>{n.title}</h3>
              </div>
              <p className={`mt-1.5 text-sm ${n.pinned ? 'text-white/80' : 'text-muted'}`}>{n.content}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default NoticeBanner
