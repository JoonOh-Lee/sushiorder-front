import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import { StaffHeader } from '../../components/StaffHeader'
import {
  listAuditLogs,
  type AuditAction,
  type AuditLog,
  type AuditLogPage,
  type AuditResult,
} from '../../api/staff/admin/auditLogApi'
import { getStaffAuth } from '../../api/staff/auth'

const PAGE_SIZE = 20

const ACTION_OPTIONS: { value: AuditAction; label: string }[] = [
  { value: 'ORDER_PLACED', label: '주문 접수' },
  { value: 'ORDER_CONFIRMED', label: '주문 확정' },
  { value: 'ORDER_COMPLETED', label: '주문 완료' },
  { value: 'ORDER_CANCELLED', label: '주문 취소' },
  { value: 'TABLE_OCCUPIED', label: '착석' },
  { value: 'TABLE_RELEASED', label: '퇴석' },
  { value: 'STAFF_LOGIN', label: '직원 로그인' },
]

const ACTION_COLOR: Record<AuditAction, string> = {
  ORDER_PLACED: 'bg-blue-100 text-blue-700',
  ORDER_CONFIRMED: 'bg-primary-100 text-primary-700',
  ORDER_COMPLETED: 'bg-primary-200 text-primary-800',
  ORDER_CANCELLED: 'bg-ink/10 text-muted',
  TABLE_OCCUPIED: 'bg-accent-400/20 text-amber-700',
  TABLE_RELEASED: 'bg-gray-100 text-gray-600',
  STAFF_LOGIN: 'bg-purple-100 text-purple-700',
}

const RESULT_STYLE: Record<AuditResult, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  FAILURE: 'bg-red-100 text-red-700',
}

const RESULT_LABEL: Record<AuditResult, string> = {
  SUCCESS: '성공',
  FAILURE: '실패',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd} ${hh}:${mi}`
}

function formatDateTimeFull(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd} ${hh}:${mi}:${ss}`
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

const selectCls =
  'w-full min-w-0 rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400'
const inputCls =
  'w-full min-w-0 rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400'

// ── 상세 아코디언 ─────────────────────────────────────────────────────────────
function DetailPanel({ log }: { log: AuditLog }) {
  const actionColor = ACTION_COLOR[log.action] ?? 'bg-primary-100 text-primary-700'
  const meta = parseMetadata(log.metadata)

  return (
    <div className="border-t border-primary-100 bg-primary-50/50 px-4 py-3">
      <div className="rounded-xl border border-primary-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">

          <Field label="로그 ID" value={`#${log.id}`} mono />
          <Field label="정확한 시각" value={formatDateTimeFull(log.createdAt)} mono />

          <Field
            label="행위자"
            value={log.actorName ?? '손님 (비인증)'}
            dimmed={log.actorName === null}
          />

          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">액션</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${actionColor}`}>
                {log.actionDisplayName}
              </span>
              <span className="font-mono text-xs text-muted">{log.action}</span>
            </div>
          </div>

          <Field label="대상 엔티티" value={`${log.entityType} #${log.entityId}`} mono />

          {log.result !== null && (
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">결과</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RESULT_STYLE[log.result]}`}>
                {RESULT_LABEL[log.result]}
              </span>
            </div>
          )}

          {log.tableNumber !== null && <Field label="테이블" value={`${log.tableNumber}번`} />}
          {log.stationName !== null && <Field label="스테이션" value={log.stationName} />}
          {log.ipAddress !== null && <Field label="IP 주소" value={log.ipAddress} mono />}

          <div className="col-span-2 min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">설명</p>
            <p className="text-sm text-ink">{log.description}</p>
          </div>

          {meta && (
            <div className="col-span-2 min-w-0">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">메타데이터</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-primary-50 px-3 py-2">
                {Object.entries(meta).map(([k, v]) => (
                  <div key={k} className="flex min-w-0 items-baseline gap-1.5">
                    <span className="shrink-0 font-mono text-[11px] text-muted">{k}</span>
                    <span className="min-w-0 truncate font-mono text-[11px] text-ink">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.userAgent !== null && (
            <div className="col-span-2 min-w-0">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">User-Agent</p>
              <p className="break-all font-mono text-[11px] text-muted">{log.userAgent}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
  dimmed,
}: {
  label: string
  value: string
  mono?: boolean
  dimmed?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`truncate text-sm ${mono ? 'font-mono' : 'font-medium'} ${dimmed ? 'text-muted' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
interface Props {
  onClose?: () => void
}

export default function AuditLogPage({ onClose }: Props) {
  const navigate = useNavigate()
  const auth = getStaffAuth()

  const [data, setData] = useState<AuditLogPage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const [filterAction, setFilterAction] = useState<AuditAction | ''>('')
  const [filterResult, setFilterResult] = useState<AuditResult | ''>('')
  const [filterActor, setFilterActor] = useState('')
  const [filterTableId, setFilterTableId] = useState<number | ''>('')
  const [page, setPage] = useState(0)

  const [pendingActor, setPendingActor] = useState('')
  const [pendingTableId, setPendingTableId] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    if (!auth || auth.role !== 'ADMIN') navigate('/staff')
  }, [auth, navigate])

  useEffect(() => {
    setStatus('loading')
    setExpandedId(null)
    listAuditLogs({
      action: filterAction || undefined,
      result: filterResult || undefined,
      actorName: filterActor || undefined,
      tableId: filterTableId !== '' ? filterTableId : undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((result) => {
        setData(result)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof ApiError ? err.message : '감사 로그를 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [filterAction, filterResult, filterActor, filterTableId, page])

  function handleSearch() {
    setFilterActor(pendingActor.trim())
    const n = Number(pendingTableId.trim())
    setFilterTableId(pendingTableId.trim() !== '' && !Number.isNaN(n) ? n : '')
    setPage(0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  function handleReset() {
    setFilterAction('')
    setFilterResult('')
    setFilterActor('')
    setFilterTableId('')
    setPendingActor('')
    setPendingTableId('')
    setPage(0)
  }

  const hasFilter = filterAction || filterResult || filterActor || filterTableId !== ''
  const rows: AuditLog[] = data?.content ?? []
  const totalPages = data?.totalPages ?? 1

  // 헤더·바디 공통 컬럼 정의 — tailwind arbitrary value로 일치시킴
  const ROW_COLS = 'grid-cols-[1.5rem_7.5rem_7rem_5rem_1fr]'

  return (
    <div className="flex h-full w-full flex-col overflow-x-hidden bg-surface">
      <StaffHeader title="감사 로그" onClose={onClose} />

      {/* 필터 — 2행 그리드로 고정 너비 문제 해결 */}
      <div className="shrink-0 border-b border-primary-100 bg-white px-4 py-3">
        {/* 1행: 액션·결과 드롭다운 */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value as AuditAction | ''); setPage(0) }}
            className={selectCls}
          >
            <option value="">전체 액션</option>
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value as AuditResult | ''); setPage(0) }}
            className={selectCls}
          >
            <option value="">전체 결과</option>
            <option value="SUCCESS">성공</option>
            <option value="FAILURE">실패</option>
          </select>
        </div>

        {/* 2행: 텍스트 검색 */}
        <div className="mt-2 flex items-center gap-2">
          <input
            value={pendingActor}
            onChange={(e) => setPendingActor(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="직원명"
            className={`${inputCls} flex-1`}
          />
          <input
            value={pendingTableId}
            onChange={(e) => setPendingTableId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="테이블 번호"
            inputMode="numeric"
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={handleSearch}
            className="shrink-0 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 active:bg-primary-700"
          >
            검색
          </button>
          {hasFilter && (
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 rounded-xl border border-primary-100 px-3 py-2 text-sm text-muted transition-colors hover:bg-primary-50"
            >
              초기화
            </button>
          )}
        </div>

        {data && (
          <p className="mt-1.5 text-right text-xs text-muted">
            총 {data.totalElements.toLocaleString()}건
          </p>
        )}
      </div>

      {/* 헤더 행 */}
      <div
        className={`shrink-0 grid ${ROW_COLS} items-center gap-x-3 border-b border-primary-100 bg-primary-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted`}
      >
        <span />
        <span>일시</span>
        <span>액션</span>
        <span>행위자</span>
        <span>내용</span>
      </div>

      {/* 로그 목록 */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {status === 'loading' && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">불러오는 중...</div>
        )}
        {status === 'error' && (
          <div className="flex h-40 items-center justify-center text-sm text-red-500">{errorMsg}</div>
        )}
        {status === 'ready' && rows.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            조건에 맞는 로그가 없습니다.
          </div>
        )}
        {status === 'ready' && rows.length > 0 && (
          <ul>
            {rows.map((log) => {
              const isOpen = expandedId === log.id
              const actionColor = ACTION_COLOR[log.action] ?? 'bg-primary-100 text-primary-700'

              return (
                <li key={log.id} className="border-b border-primary-50">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : log.id)}
                    className={`grid w-full ${ROW_COLS} items-center gap-x-3 px-4 py-3 text-left transition-colors ${
                      isOpen ? 'bg-primary-50' : 'hover:bg-primary-50/40'
                    }`}
                  >
                    <span
                      className={`text-[10px] text-muted transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                    >
                      ▶
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(log.createdAt)}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${actionColor}`}>
                        {log.actionDisplayName}
                      </span>
                      {log.result === 'FAILURE' && (
                        <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          실패
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-ink">
                      {log.actorName ?? <span className="text-xs text-muted">손님</span>}
                    </span>
                    <span className="min-w-0 truncate text-sm text-ink">{log.description}</span>
                  </button>

                  {isOpen && <DetailPanel log={log} />}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 페이지네이션 */}
      {status === 'ready' && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 border-t border-primary-100 bg-white px-4 py-3">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-primary-100 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-primary-50 disabled:opacity-30"
          >
            ← 이전
          </button>
          <span className="text-sm text-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-primary-100 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-primary-50 disabled:opacity-30"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}
