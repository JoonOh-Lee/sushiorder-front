import { staffFetch } from '../api/staffApi'
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
