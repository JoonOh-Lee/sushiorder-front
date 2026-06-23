import { getSessionToken } from '../customer/session'
import { apiFetch, type RequestOptions } from './client'

export function customerFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getSessionToken()

  return apiFetch<T>(path, {
    ...options,
    headers: {
      ...(token ? { 'X-Session-Token': token } : {}),
      ...options.headers,
    },
  })
}
