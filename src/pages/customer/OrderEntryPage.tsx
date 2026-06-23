import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { createSession } from '../../customer/sessionApi'
import { setSessionToken } from '../../customer/session'

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
    return <p>세션을 연결하는 중입니다...</p>
  }

  if (status === 'error') {
    return <p>{errorMessage}</p>
  }

  return (
    <div>
      <h1>주문 페이지</h1>
      <p>테이블: {tableId}</p>
    </div>
  )
}

export default OrderEntryPage
