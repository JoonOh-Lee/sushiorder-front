import { apiFetch } from '../api/client'

// 백엔드 MenuCategory enum 값. 새 카테고리가 추가돼도 프론트가 알 필요 없도록 string으로 둔다 —
// 실제 탭 목록은 메뉴 조회 응답에서 동적으로 뽑아서 그린다.
export type MenuCategory = string

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

export function likeMenu(id: number): Promise<void> {
  return apiFetch<void>(`/api/v1/menu/${id}/like`, { method: 'POST' })
}

export function dislikeMenu(id: number): Promise<void> {
  return apiFetch<void>(`/api/v1/menu/${id}/dislike`, { method: 'POST' })
}
