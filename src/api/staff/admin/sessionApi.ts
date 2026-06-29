import { staffFetch } from '../../staffApi'

export function closeSession(sessionId: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/session/${sessionId}/close`, { method: 'PATCH' })
}
