import { staffFetch } from '../../staffApi'
import type { Station } from '../stationApi'

export function listAllStations(): Promise<Station[]> {
  return staffFetch<Station[]>('/api/v1/admin/station')
}

export function createStation(name: string): Promise<Station> {
  return staffFetch<Station>('/api/v1/admin/station', { method: 'POST', body: { name } })
}

export function renameStation(id: number, name: string): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/station/${id}/name`, { method: 'PATCH', body: { name } })
}

export function reorderStations(orders: { stationId: number; sortOrder: number }[]): Promise<void> {
  return staffFetch<void>('/api/v1/admin/station/order', { method: 'PATCH', body: { orders } })
}

export function activateStation(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/station/${id}/activate`, { method: 'PATCH' })
}

export function deactivateStation(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/station/${id}/deactivate`, { method: 'PATCH' })
}
