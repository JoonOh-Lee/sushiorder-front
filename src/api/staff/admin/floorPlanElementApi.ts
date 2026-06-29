import { staffFetch } from '../../staffApi'
import type { FloorPlanElement, FloorPlanElementType } from '../floorPlanElementApi'

export interface FloorPlanElementCreateInput {
  type: FloorPlanElementType
  label?: string
  x: number
  y: number
  width: number
  height: number
}

export interface FloorPlanElementPosition {
  x: number
  y: number
  width: number
  height: number
}

export function createFloorPlanElement(input: FloorPlanElementCreateInput): Promise<FloorPlanElement> {
  return staffFetch<FloorPlanElement>('/api/v1/admin/floor-plan-element', {
    method: 'POST',
    body: input,
  })
}

export function updateFloorPlanElementPosition(
  id: number,
  position: FloorPlanElementPosition,
): Promise<FloorPlanElement> {
  return staffFetch<FloorPlanElement>(`/api/v1/admin/floor-plan-element/${id}/position`, {
    method: 'PATCH',
    body: position,
  })
}

export function deleteFloorPlanElement(id: number): Promise<void> {
  return staffFetch<void>(`/api/v1/admin/floor-plan-element/${id}`, { method: 'DELETE' })
}
