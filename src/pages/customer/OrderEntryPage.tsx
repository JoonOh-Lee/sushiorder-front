import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { createSession } from '../../customer/sessionApi'
import { setSessionToken } from '../../customer/session'
import MenuListPage from './MenuListPage'

type Status = 'loading' | 'ready' | 'error'

function OrderEntryPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const requestedRef = useRef(false)

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true

    const numericTableId = Number(tableId)

    Promise.resolve()
      .then(() => {
        if (!tableId || Number.isNaN(numericTableId)) {
          throw new ApiError('잘못된 테이블 정보입니다.')
        }
        return createSession(numericTableId)
      })
      .then(({ sessionToken }) => {
        setSessionToken(sessionToken)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '세션 생성에 실패했습니다.')
        setStatus('error')
      })
  }, [tableId])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-muted">세션을 연결하는 중입니다...</p>
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
    <div className="min-h-screen bg-surface">
      <header className="bg-primary-500 px-4 py-5 text-white">
        <p className="text-sm font-medium text-primary-50">테이블 {tableId}</p>
        <h1 className="text-xl font-bold">오늘 뭐 드실래요?</h1>
      </header>
      <MenuListPage />
    </div>
  )
}

export default OrderEntryPage
