import { staffFetch } from '../../staffApi'
import type { Notice } from '../../../customer/noticeApi'

export interface NoticeInput {
  title: string
  content: string
}

export function listAllNotices(): Promise<Notice[]> {
  return staffFetch<Notice[]>('/api/v1/admin/notice')
}

export function createNotice(input: NoticeInput): Promise<Notice> {
  return staffFetch<Notice>('/api/v1/admin/notice', { method: 'POST', body: input })
}

export function updateNotice(id: number, input: NoticeInput): Promise<Notice> {
  return staffFetch<Notice>(`/api/v1/admin/notice/${id}`, { method: 'PATCH', body: input })
}

export function pinNotice(id: number): Promise<Notice> {
  return staffFetch<Notice>(`/api/v1/admin/notice/${id}/pin`, { method: 'PATCH' })
}

export function unpinNotice(id: number): Promise<Notice> {
  return staffFetch<Notice>(`/api/v1/admin/notice/${id}/unpin`, { method: 'PATCH' })
}

export function activateNotice(id: number): Promise<Notice> {
  return staffFetch<Notice>(`/api/v1/admin/notice/${id}/activate`, { method: 'PATCH' })
}

export function deactivateNotice(id: number): Promise<Notice> {
  return staffFetch<Notice>(`/api/v1/admin/notice/${id}/deactivate`, { method: 'PATCH' })
}
