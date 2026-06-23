import { useEffect, useState } from 'react'
import { fetchNotices, type Notice } from '../../customer/noticeApi'

const ROTATE_INTERVAL_MS = 4000

function NoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [index, setIndex] = useState(0)

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
    <div className="flex items-center gap-3 overflow-hidden bg-primary-50 px-4 py-2.5">
      <span className="shrink-0 rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-bold text-white">공지</span>
      <p key={notice.id} className="flex-1 truncate text-sm font-medium text-primary-700 animate-notice-fade">
        {notice.title}
      </p>
      {notices.length > 1 && (
        <span className="shrink-0 text-xs font-medium text-primary-400">
          {index + 1}/{notices.length}
        </span>
      )}
    </div>
  )
}

export default NoticeBanner
