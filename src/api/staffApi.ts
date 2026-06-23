import { getStaffToken } from '../auth/staffAuth'
import { apiFetch, type RequestOptions } from './client'

export function staffFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getStaffToken()

  return apiFetch<T>(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}
