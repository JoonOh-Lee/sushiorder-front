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

/** station 필터 없이 매장 전체 활성 주문 — 매장 현황판(floor board)에서 테이블별 하이라이트용 */
export function listAllActiveOrders(): Promise<Order[]> {
  const params = new URLSearchParams()
  params.append('status', 'PENDING')
  params.append('status', 'CONFIRMED')
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
