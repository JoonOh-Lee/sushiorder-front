import { useState } from 'react'
import { ApiError } from '../../api/types'
import { callStaff, type CallType } from '../../customer/callApi'
import { BellIcon } from '../../customer/icons'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const CALL_OPTIONS: { type: CallType; itemName?: string; label: string }[] = [
  { type: 'WATER_REFILL', label: '물 리필해주세요' },
  { type: 'ITEM_REQUEST', itemName: '물티슈', label: '물티슈 주세요' },
  { type: 'ITEM_REQUEST', itemName: '수저/젓가락', label: '수저·젓가락 주세요' },
  { type: 'ITEM_REQUEST', itemName: '장국 추가', label: '장국 추가해주세요' },
  { type: 'INQUIRY', label: '문의할 게 있어요' },
  { type: 'OTHER', label: '기타 도움이 필요해요' },
]

function CallStaffButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  function close() {
    setIsOpen(false)
    setStatus('idle')
    setErrorMessage('')
  }

  function handleSelect(type: CallType, itemName?: string) {
    setStatus('submitting')
    callStaff(type, itemName)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '호출에 실패했습니다.')
        setStatus('error')
      })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="직원 호출"
        className="flex items-center gap-1.5 rounded-full bg-primary-50 px-3.5 py-2.5 text-sm font-semibold text-primary-600 transition-transform active:scale-95"
      >
        <BellIcon className="h-5 w-5" />
        직원호출
      </button>

      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={close} />
        <div
          className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface-raised p-5 transition-transform duration-300 ${
            isOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {status === 'success' ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-lg font-bold text-ink">호출했어요!</p>
              <p className="text-base text-muted">직원이 곧 도와드릴게요.</p>
              <button
                type="button"
                onClick={close}
                className="mt-3 rounded-full bg-primary-500 px-6 py-3 text-base font-semibold text-white transition-transform active:scale-95"
              >
                확인
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-ink">직원 호출</h2>
              {status === 'error' && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
              <div className="mt-4 grid gap-2.5">
                {CALL_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    disabled={status === 'submitting'}
                    onClick={() => handleSelect(option.type, option.itemName)}
                    className="rounded-xl bg-surface px-4 py-3.5 text-left text-base font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default CallStaffButton
