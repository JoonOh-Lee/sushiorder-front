import { staffFetch } from '../staffApi'

export type CallType = 'WATER_REFILL' | 'INQUIRY' | 'ITEM_REQUEST' | 'OTHER'
export type CallStatus = 'REQUESTED' | 'RESOLVED'

export interface StaffCall {
  id: number
  tableId: number
  sessionId: number
  type: CallType
  itemName: string | null
  status: CallStatus
  createdAt: string
}

export function listStaffCalls(): Promise<StaffCall[]> {
  return staffFetch<StaffCall[]>('/api/v1/staff/call')
}

export function resolveStaffCall(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/staff/call/${id}/resolve`, { method: 'PATCH' })
}
