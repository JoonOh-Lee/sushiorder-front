const STAFF_TOKEN_KEY = 'sushiorder.staff.token'

export function getStaffToken(): string | null {
  return localStorage.getItem(STAFF_TOKEN_KEY)
}

export function setStaffToken(token: string): void {
  localStorage.setItem(STAFF_TOKEN_KEY, token)
}

export function clearStaffToken(): void {
  localStorage.removeItem(STAFF_TOKEN_KEY)
}
