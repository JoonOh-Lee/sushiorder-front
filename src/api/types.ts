export interface ApiResponse<T> {
  success: boolean
  data: T | null
  message: string | null
}

export class ApiError extends Error {}

export class UnauthorizedError extends Error {}
