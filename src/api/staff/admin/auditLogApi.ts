import { staffFetch } from '../../staffApi'

export type AuditAction =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'TABLE_OCCUPIED'
  | 'TABLE_RELEASED'
  | 'STAFF_LOGIN'

export type AuditResult = 'SUCCESS' | 'FAILURE'

export interface AuditLog {
  id: number
  actorName: string | null
  action: AuditAction
  actionDisplayName: string
  entityType: string
  entityId: number
  description: string
  createdAt: string
  // 신규 필드 (선택)
  result: AuditResult | null
  tableId: number | null
  tableNumber: number | null
  stationId: number | null
  stationName: string | null
  ipAddress: string | null
  metadata: string | null
  userAgent: string | null
}

export interface AuditLogPage {
  content: AuditLog[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface AuditLogParams {
  action?: AuditAction
  result?: AuditResult
  actorName?: string
  tableId?: number
  page?: number
  size?: number
}

export async function listAuditLogs(params: AuditLogParams = {}): Promise<AuditLogPage> {
  const query = new URLSearchParams()
  if (params.action) query.set('action', params.action)
  if (params.result) query.set('result', params.result)
  if (params.actorName) query.set('actorName', params.actorName)
  if (params.tableId !== undefined) query.set('tableId', String(params.tableId))
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.size !== undefined) query.set('size', String(params.size))
  const qs = query.toString()
  return staffFetch<AuditLogPage>(`/api/v1/admin/audit-log${qs ? `?${qs}` : ''}`)
}
