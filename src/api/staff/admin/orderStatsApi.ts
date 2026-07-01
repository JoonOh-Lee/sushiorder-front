import { staffFetch } from '../../staffApi'

export interface TopMenu {
  menuId: number
  menuName: string
  quantity: number
  revenue: number
}

export interface OrderStats {
  totalOrders: number
  totalRevenue: number
  topMenus: TopMenu[]
  hourlyDistribution: number[]
}

export function getOrderStats(date?: string): Promise<OrderStats> {
  const qs = date ? `?date=${date}` : ''
  return staffFetch<OrderStats>(`/api/v1/admin/order/stats${qs}`)
}
