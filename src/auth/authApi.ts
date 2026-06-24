import { apiFetch } from '../api/client'
import type { StaffAuth } from './staffAuth'

export function login(username: string, password: string): Promise<StaffAuth> {
  return apiFetch<StaffAuth>('/api/v1/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}
