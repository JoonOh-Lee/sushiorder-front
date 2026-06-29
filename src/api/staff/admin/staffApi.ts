import { staffFetch } from '../../staffApi'
import type { StaffRole } from '../auth'

export interface StaffMember {
  id: number
  username: string
  role: StaffRole
  stationId: number | null
  onDuty: boolean
  active: boolean
}

export function listAllStaff(): Promise<StaffMember[]> {
  return staffFetch<StaffMember[]>('/api/v1/admin/staff')
}

export function createStaff(input: {
  username: string
  password: string
  role: StaffRole
}): Promise<StaffMember> {
  return staffFetch<StaffMember>('/api/v1/admin/staff', { method: 'POST', body: input })
}

export function changeStaffRole(id: number, role: StaffRole): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/staff/${id}/role`, { method: 'PATCH', body: { role } })
}

export function changeStaffPassword(id: number, password: string): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/staff/${id}/password`, {
    method: 'PATCH',
    body: { password },
  })
}

export function activateStaff(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/staff/${id}/activate`, { method: 'PATCH' })
}

export function deactivateStaff(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/staff/${id}/deactivate`, { method: 'PATCH' })
}
