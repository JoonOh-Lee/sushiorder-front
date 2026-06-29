import { staffFetch } from '../staffApi'

export type FloorPlanElementType = 'KITCHEN' | 'RAIL' | 'ETC'

export interface FloorPlanElement {
  id: number
  type: FloorPlanElementType
  label: string | null
  x: number
  y: number
  width: number
  height: number
}

export function listFloorPlanElements(): Promise<FloorPlanElement[]> {
  return staffFetch<FloorPlanElement[]>('/api/v1/floor-plan-element')
}
