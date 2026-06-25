import { staffFetch } from '../api/staffApi'

export type SeatType = 'TABLE' | 'COUNTER'
export type TableStatus = 'EMPTY' | 'OCCUPIED' | 'RESERVED'

export interface RestaurantTable {
  id: number
  seatType: SeatType
  tableNumber: number
  seatCount: number
  status: TableStatus
  x: number | null
  y: number | null
  width: number | null
  height: number | null
}

export function listTables(): Promise<RestaurantTable[]> {
  return staffFetch<RestaurantTable[]>('/api/v1/table')
}
