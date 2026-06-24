import { apiFetch } from '../api/client'

export interface Notice {
  id: number
  title: string
  content: string
  pinned: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export function fetchNotices(): Promise<Notice[]> {
  return apiFetch<Notice[]>('/api/v1/notice')
}
