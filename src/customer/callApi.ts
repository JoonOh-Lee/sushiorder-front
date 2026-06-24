import { customerFetch } from '../api/customerApi'

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

export function callStaff(type: CallType, itemName?: string): Promise<StaffCall> {
  return customerFetch<StaffCall>('/api/v1/call', {
    method: 'POST',
    body: itemName ? { type, itemName } : { type },
  })
}
