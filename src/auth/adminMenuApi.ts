import { staffFetch } from '../api/staffApi'
import type { MenuItem } from '../customer/menuApi'

export interface MenuCreateInput {
  name: string
  description: string
  price: number
  category: string
  imageUrl: string
  stockCount: number | null
  stationId: number
}

export interface MenuUpdateInput {
  name: string
  description: string
  category: string
  imageUrl: string
}

export function listAllMenus(): Promise<MenuItem[]> {
  return staffFetch<MenuItem[]>('/api/v1/menu?activeOnly=false')
}

export function createMenu(input: MenuCreateInput): Promise<MenuItem> {
  return staffFetch<MenuItem>('/api/v1/admin/menu', { method: 'POST', body: input })
}

export function updateMenu(id: number, input: MenuUpdateInput): Promise<MenuItem> {
  return staffFetch<MenuItem>(`/api/v1/admin/menu/${id}`, { method: 'PUT', body: input })
}

export function changeMenuPrice(id: number, price: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/menu/${id}/price`, {
    method: 'PATCH',
    body: { price },
  })
}

export function restockMenu(id: number, quantity: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/menu/${id}/restock`, {
    method: 'PATCH',
    body: { quantity },
  })
}

export function setMenuStock(id: number, stockCount: number | null): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/menu/${id}/stock`, {
    method: 'PATCH',
    body: { stockCount },
  })
}

export function activateMenu(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/menu/${id}/activate`, { method: 'PATCH' })
}

export function deactivateMenu(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/menu/${id}/deactivate`, { method: 'PATCH' })
}
