import { apiFetch } from '../api/client'

export type MenuCategory = 'SUSHI' | 'ROLL' | 'SIDE' | 'DRINK' | 'DESSERT'

export interface MenuItem {
  id: number
  name: string
  description: string
  price: number
  category: MenuCategory
  imageUrl: string
  stockCount: number | null
  limitedStock: boolean
  likeCount: number
  dislikeCount: number
  active: boolean
  stationId: number
}

export function fetchMenus(): Promise<MenuItem[]> {
  return apiFetch<MenuItem[]>('/api/v1/menu?activeOnly=true')
}
