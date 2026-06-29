import { clearStaffAuth, getStaffToken } from '../auth/staffAuth'
import { apiFetch, type RequestOptions } from './client'
import { UnauthorizedError } from './types'

export async function staffFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getStaffToken()

  try {
    return await apiFetch<T>(path, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      clearStaffAuth()
      window.location.href = '/staff/login'
      return new Promise(() => {})
    }
    throw err
  }
}
