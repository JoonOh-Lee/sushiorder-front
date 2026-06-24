export type SeatType = 'TABLE' | 'COUNTER'

const SEAT_TYPE_LABEL: Record<SeatType, string> = {
  TABLE: '테이블',
  COUNTER: '다찌석',
}

export function formatSeatLabel(seatType: SeatType, tableNumber: number): string {
  return `${SEAT_TYPE_LABEL[seatType]}${tableNumber}`
}
