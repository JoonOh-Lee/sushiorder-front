import { apiFetch } from '../api/client'
import type { SeatType } from './seat'

export type SessionStatus = 'ACTIVE' | 'EXPIRED' | 'CLOSED'

export interface TableSessionResponse {
  tableId: number
  sessionToken: string
  seatType: SeatType
  tableNumber: number
  status: SessionStatus
}

export function createSession(tableId: number): Promise<TableSessionResponse> {
  return apiFetch<TableSessionResponse>('/api/v1/session', {
    method: 'POST',
    body: { tableId },
  })
}

export function getSessionByToken(sessionToken: string): Promise<TableSessionResponse> {
  return apiFetch<TableSessionResponse>(`/api/v1/session/${sessionToken}`)
}
