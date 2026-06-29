import { staffFetch } from '../../staffApi'
import type { RailSegment } from '../railSegmentApi'

export function activateRailSegment(id: number): Promise<RailSegment> {
  return staffFetch<RailSegment>(`/api/v1/admin/rail-segment/${id}/activate`, { method: 'PATCH' })
}

export function deactivateRailSegment(id: number): Promise<RailSegment> {
  return staffFetch<RailSegment>(`/api/v1/admin/rail-segment/${id}/deactivate`, { method: 'PATCH' })
}

export function reorderRailSegments(
  orders: { segmentId: number; sequenceOrder: number }[],
): Promise<void> {
  return staffFetch<void>('/api/v1/admin/rail-segment/order', {
    method: 'PATCH',
    body: { orders },
  })
}
