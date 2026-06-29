import { API_BASE_URL } from '../api/client'
import { staffFetch } from '../api/staffApi'
import { getStaffToken } from './staffAuth'
import type { RestaurantTable } from './tableApi'

export interface TablePosition {
  x: number
  y: number
  width: number
  height: number
}

export function updateTablePosition(id: number, position: TablePosition): Promise<RestaurantTable> {
  return staffFetch<RestaurantTable>(`/api/v1/admin/table/${id}/position`, {
    method: 'PATCH',
    body: position,
  })
}

export async function fetchTableQrBlobUrl(tableId: number): Promise<string> {
  const token = getStaffToken()
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/table/${tableId}/qr`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('QR 코드를 불러오지 못했습니다.')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
