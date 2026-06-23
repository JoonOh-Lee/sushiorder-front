import { apiFetch } from '../api/client'
import type { SeatType } from './seat'

interface CreateSessionResponse {
  sessionToken: string
  seatType: SeatType
  tableNumber: number
}

export function createSession(tableId: number): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>('/api/v1/session', {
    method: 'POST',
    body: { tableId },
  })
}
