export type StaffRole = 'STAFF' | 'ADMIN'

export interface StaffAuth {
  token: string
  username: string
  role: StaffRole
  stationId: number | null
  onDuty: boolean
}

const STAFF_AUTH_KEY = 'sushiorder.staff.auth'

export function getStaffAuth(): StaffAuth | null {
  const raw = localStorage.getItem(STAFF_AUTH_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StaffAuth
  } catch {
    return null
  }
}

export function setStaffAuth(auth: StaffAuth): void {
  localStorage.setItem(STAFF_AUTH_KEY, JSON.stringify(auth))
}

export function clearStaffAuth(): void {
  localStorage.removeItem(STAFF_AUTH_KEY)
}

export function updateStaffAuthStationId(stationId: number): void {
  const current = getStaffAuth()
  if (!current) return
  setStaffAuth({ ...current, stationId })
}

export function updateStaffAuthOnDuty(onDuty: boolean): void {
  const current = getStaffAuth()
  if (!current) return
  setStaffAuth({ ...current, onDuty })
}

export function getStaffToken(): string | null {
  return getStaffAuth()?.token ?? null
}
