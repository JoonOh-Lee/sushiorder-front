import { customerFetch } from '../api/customerApi'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export interface OrderItem {
  id: number
  menuId: number
  menuName: string
  unitPrice: number
  quantity: number
  subtotal: number
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

export interface PlaceOrderItem {
  menuId: number
  quantity: number
}

export function placeOrder(items: PlaceOrderItem[]): Promise<Order> {
  return customerFetch<Order>('/api/v1/order', {
    method: 'POST',
    body: {
      idempotencyKey: crypto.randomUUID(),
      items,
    },
  })
}
