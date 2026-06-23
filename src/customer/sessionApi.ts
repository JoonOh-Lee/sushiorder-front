import { apiFetch } from '../api/client'

interface CreateSessionResponse {
  sessionToken: string
}

export function createSession(tableId: number): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>('/api/v1/session', {
    method: 'POST',
    body: { tableId },
  })
}
