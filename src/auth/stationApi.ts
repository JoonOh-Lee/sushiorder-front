import { staffFetch } from '../api/staffApi'
import type { StaffRole } from './staffAuth'

export interface Station {
  id: number
  name: string
  sortOrder: number
  active: boolean
  hasOnDutyStaff: boolean
}

export interface StaffMe {
  id: number
  username: string
  role: StaffRole
  stationId: number | null
  onDuty: boolean
}

export function listStations(): Promise<Station[]> {
  return staffFetch<Station[]>('/api/v1/station')
}

export function assignMyStation(stationId: number): Promise<StaffMe> {
  return staffFetch<StaffMe>('/api/v1/staff/me/station', {
    method: 'PATCH',
    body: { stationId },
  })
}

export function setMyDuty(on: boolean): Promise<StaffMe> {
  return staffFetch<StaffMe>('/api/v1/staff/me/duty', {
    method: 'PATCH',
    body: { on },
  })
}
