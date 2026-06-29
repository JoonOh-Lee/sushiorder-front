import type { FloorPlanElement } from '../auth/floorPlanElementApi'
import type { RailSegment } from '../auth/railSegmentApi'
import type { RestaurantTable } from '../auth/tableApi' // tableToArcT에서 사용

export const BELT_THICKNESS = 4.5
export const KITCHEN_GAP = 0.8

export interface BeltGeo {
  kitchen: FloorPlanElement
  kx: number
  ky: number
  kw: number
  kh: number
  kitchenRight: number
  kitchenBottom: number
  rx: number
  ry: number
  rw: number
  rh: number
  th: number
  T_TOP_END: number
  T_RIGHT_START: number
  T_RIGHT_END: number
  T_BOTTOM_START: number
  T_BOTTOM_END: number
  T_LEFT_START: number
  T_LEFT_END: number
  T_TOTAL: number
}

export function computeBeltGeo(
  elements: FloorPlanElement[],
  tables: RestaurantTable[],
): BeltGeo | null {
  const kitchen = elements.find((e) => e.type === 'KITCHEN')
  if (!kitchen) return null

  const kx = kitchen.x - KITCHEN_GAP
  const ky = kitchen.y - KITCHEN_GAP
  const kw = kitchen.width + KITCHEN_GAP * 2
  const kh = kitchen.height + KITCHEN_GAP * 2
  const kitchenRight = kitchen.x + kitchen.width
  const kitchenBottom = kitchen.y + kitchen.height

  const westTables = tables.filter(
    (t) => t.x != null && t.width != null && t.x + t.width <= kitchen.x,
  )
  const eastTables = tables.filter((t) => t.x != null && t.x >= kitchenRight)
  const sideTables = new Set([...westTables, ...eastTables])
  const northTables = tables.filter(
    (t) => !sideTables.has(t) && t.y != null && t.height != null && t.y + t.height <= kitchen.y,
  )
  const southTables = tables.filter(
    (t) => !sideTables.has(t) && t.y != null && t.y >= kitchenBottom,
  )

  const th = BELT_THICKNESS
  const beltLeft = westTables.length > 0 ? th : 0
  const beltRight = eastTables.length > 0 ? th : 0
  const beltTop = northTables.length > 0 ? th : 0
  const beltBottom = southTables.length > 0 ? th : 0

  if (beltLeft === 0 && beltRight === 0 && beltTop === 0 && beltBottom === 0) return null

  const rx = kx - beltLeft
  const ry = ky - beltTop
  const rw = kw + beltLeft + beltRight
  const rh = kh + beltTop + beltBottom

  const cornerArc = (Math.PI / 2) * (th / 2)
  const T_TOP_END = rw - 2 * th
  const T_RIGHT_START = T_TOP_END + cornerArc
  const T_RIGHT_END = T_RIGHT_START + (rh - 2 * th)
  const T_BOTTOM_START = T_RIGHT_END + cornerArc
  const T_BOTTOM_END = T_BOTTOM_START + (rw - 2 * th)
  const T_LEFT_START = T_BOTTOM_END + cornerArc
  const T_LEFT_END = T_LEFT_START + (rh - 2 * th)
  const T_TOTAL = T_LEFT_END + cornerArc

  return {
    kitchen,
    kx, ky, kw, kh,
    kitchenRight, kitchenBottom,
    rx, ry, rw, rh,
    th,
    T_TOP_END,
    T_RIGHT_START, T_RIGHT_END,
    T_BOTTOM_START, T_BOTTOM_END,
    T_LEFT_START, T_LEFT_END,
    T_TOTAL,
  }
}

// 테이블의 물리적 위치를 CW 기준 arc-length t 값으로 변환
export function tableToArcT(table: RestaurantTable, geo: BeltGeo): number {
  if (table.x === null || table.y === null || table.width === null || table.height === null) return 0

  const { kitchen, kitchenRight, rx, ry, rw, rh, th, T_RIGHT_START, T_BOTTOM_START, T_LEFT_START } = geo
  const tcx = table.x + table.width / 2
  const tcy = table.y + table.height / 2
  const isWest = table.x + table.width <= kitchen.x
  const isEast = table.x >= kitchenRight

  if (isWest) {
    const cy = Math.max(ry + th, Math.min(ry + rh - th, tcy))
    return T_LEFT_START + (ry + rh - th - cy)
  } else if (isEast) {
    const cy = Math.max(ry + th, Math.min(ry + rh - th, tcy))
    return T_RIGHT_START + (cy - (ry + th))
  } else if (table.y + table.height <= kitchen.y) {
    const cx = Math.max(rx + th, Math.min(rx + rw - th, tcx))
    return cx - (rx + th)
  } else {
    const cx = Math.max(rx + th, Math.min(rx + rw - th, tcx))
    return T_BOTTOM_START + (rx + rw - th - cx)
  }
}

// 테이블 물리 위치(arc-length) 기반으로 segment 흐름 순서를 계산 → reorder API 호출용
// 세그먼트 그래프(fromTableId→toTableId)를 트래버스하되, 시작점은 arc-length가 크게 감소하는
// 구간(= 벨트가 주방을 통과하는 우회 구간)의 toTable로 잡는다.
export function computeReorderFromPositions(
  segments: RailSegment[],
  tables: RestaurantTable[],
  geo: BeltGeo,
): { segmentId: number; sequenceOrder: number }[] {
  if (segments.length === 0) return []

  const fromMap = new Map<number, RailSegment>()
  for (const seg of segments) fromMap.set(seg.fromTableId, seg)

  const tMap = new Map<number, number>()
  for (const t of tables) tMap.set(t.id, tableToArcT(t, geo))

  // arc-length가 T_TOTAL/2 이상 감소하는 segment = 주방 우회 구간
  const HALF = geo.T_TOTAL / 2
  let wrapSeg: RailSegment | undefined
  let maxDrop = HALF
  for (const seg of segments) {
    const drop = (tMap.get(seg.fromTableId) ?? 0) - (tMap.get(seg.toTableId) ?? 0)
    if (drop > maxDrop) { maxDrop = drop; wrapSeg = seg }
  }

  // 시작점: 주방 우회 구간 직후 테이블, 없으면 fromTable t 최솟값
  let startTableId = segments[0].fromTableId
  if (wrapSeg) {
    startTableId = wrapSeg.toTableId
  } else {
    let minT = Infinity
    for (const seg of segments) {
      const t = tMap.get(seg.fromTableId) ?? Infinity
      if (t < minT) { minT = t; startTableId = seg.fromTableId }
    }
  }

  // 그래프 트래버스
  const ordered: RailSegment[] = []
  const visited = new Set<number>()
  let current = startTableId
  for (let i = 0; i < segments.length; i++) {
    const seg = fromMap.get(current)
    if (!seg || visited.has(seg.id)) break
    ordered.push(seg)
    visited.add(seg.id)
    current = seg.toTableId
  }
  // 연결되지 않은 구간이 있으면 뒤에 추가
  for (const seg of segments) {
    if (!visited.has(seg.id)) ordered.push(seg)
  }

  return ordered.map((seg, i) => ({ segmentId: seg.id, sequenceOrder: i + 1 }))
}

// sequenceOrder 기준으로 정렬 후 flow-cut 적용
// arc-length(물리 위치) 정렬은 순환 벨트 wrap-around를 알 수 없어 오동작함
export function computeEffectiveActiveIds(
  segments: RailSegment[],
  direction: 'cw' | 'ccw',
): Set<number> {
  const sorted = [...segments].sort((a, b) =>
    direction === 'cw' ? a.sequenceOrder - b.sequenceOrder : b.sequenceOrder - a.sequenceOrder,
  )

  const ids = new Set<number>()
  let flowCut = false
  for (const seg of sorted) {
    if (!seg.active) flowCut = true
    if (!flowCut) ids.add(seg.id)
  }
  return ids
}
