import { staffFetch } from '../api/staffApi'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export interface OrderItem {
  id: number
  menuId: number
  menuName: string
  unitPrice: number
  quantity: number
  subtotal: number
  status: OrderStatus
  stationId: number
}

export interface Order {
  id: number
  tableId: number
  sessionId: number
  status: OrderStatus
  totalPrice: number
  items: OrderItem[]
  createdAt: string
}

export function listStaffOrders(stationId: number): Promise<Order[]> {
  const params = new URLSearchParams()
  params.append('status', 'PENDING')
  params.append('status', 'CONFIRMED')
  params.append('stationId', String(stationId))
  return staffFetch<Order[]>(`/api/v1/staff/order?${params.toString()}`)
}

export function confirmStationItems(orderId: number, stationId: number): Promise<Order> {
  return staffFetch<Order>(`/api/v1/staff/order/${orderId}/station/${stationId}/confirm`, { method: 'PATCH' })
}

export function completeStationItems(orderId: number, stationId: number): Promise<Order> {
  return staffFetch<Order>(`/api/v1/staff/order/${orderId}/station/${stationId}/complete`, { method: 'PATCH' })
}

export function cancelStationItems(orderId: number, stationId: number): Promise<Order> {
  return staffFetch<Order>(`/api/v1/staff/order/${orderId}/station/${stationId}/cancel`, { method: 'PATCH' })
}
