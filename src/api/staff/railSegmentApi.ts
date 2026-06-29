import { staffFetch } from '../staffApi'

export interface RailSegment {
  id: number
  sequenceOrder: number
  fromTableId: number
  toTableId: number
  active: boolean
}

export function listRailSegments(): Promise<RailSegment[]> {
  return staffFetch<RailSegment[]>('/api/v1/rail-segment')
}
