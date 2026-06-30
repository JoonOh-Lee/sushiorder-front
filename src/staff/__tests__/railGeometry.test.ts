import { describe, it, expect } from 'vitest'
import type { RailSegment } from '../../api/staff/railSegmentApi'
import type { RestaurantTable } from '../../api/staff/tableApi'
import type { FloorPlanElement } from '../../api/staff/floorPlanElementApi'
import {
  computeBeltGeo,
  computeEffectiveActiveIds,
  computeReorderFromPositions,
  tableToArcT,
} from '../railGeometry'

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function seg(
  id: number,
  sequenceOrder: number,
  active: boolean,
  fromTableId = 0,
  toTableId = 0,
): RailSegment {
  return { id, sequenceOrder, active, fromTableId, toTableId }
}

function table(
  id: number,
  x: number,
  y: number,
  w = 10,
  h = 10,
): RestaurantTable {
  return {
    id,
    seatType: 'TABLE',
    tableNumber: id,
    seatCount: 4,
    status: 'EMPTY',
    x,
    y,
    width: w,
    height: h,
  }
}

// 주방(KITCHEN)을 중앙에 배치한 기본 기물 세트
function kitchen(x = 40, y = 40, w = 20, h = 20): FloorPlanElement {
  return { id: 1, type: 'KITCHEN', label: null, x, y, width: w, height: h }
}

// ─── computeEffectiveActiveIds ─────────────────────────────────────────────────

describe('computeEffectiveActiveIds', () => {
  it('모든 구간 활성 → 전부 effectiveActive', () => {
    const segs = [seg(1, 1, true), seg(2, 2, true), seg(3, 3, true)]
    const result = computeEffectiveActiveIds(segs, 'cw')
    expect(result).toEqual(new Set([1, 2, 3]))
  })

  it('중간 구간 비활성(seq=2) → 1만 active, 2·3 컷오프', () => {
    const segs = [seg(1, 1, true), seg(2, 2, false), seg(3, 3, true)]
    const result = computeEffectiveActiveIds(segs, 'cw')
    expect(result).toEqual(new Set([1]))
  })

  it('첫 구간 비활성 → 아무것도 effectiveActive 없음', () => {
    const segs = [seg(1, 1, false), seg(2, 2, true), seg(3, 3, true)]
    const result = computeEffectiveActiveIds(segs, 'cw')
    expect(result).toEqual(new Set())
  })

  it('마지막 구간만 비활성 → 앞 2개는 active', () => {
    const segs = [seg(1, 1, true), seg(2, 2, true), seg(3, 3, false)]
    const result = computeEffectiveActiveIds(segs, 'cw')
    expect(result).toEqual(new Set([1, 2]))
  })

  it('레거시 상태: inactive가 여러 개 → 첫 번째에서 컷오프', () => {
    // seq 2,3 모두 inactive → seq 2에서 컷
    const segs = [seg(1, 1, true), seg(2, 2, false), seg(3, 3, false), seg(4, 4, true)]
    const result = computeEffectiveActiveIds(segs, 'cw')
    expect(result).toEqual(new Set([1]))
  })

  it('단일 구간 active → 해당 구간만 active', () => {
    expect(computeEffectiveActiveIds([seg(1, 1, true)], 'cw')).toEqual(new Set([1]))
  })

  it('단일 구간 inactive → effectiveActive 없음', () => {
    expect(computeEffectiveActiveIds([seg(1, 1, false)], 'cw')).toEqual(new Set())
  })

  it('빈 배열 → 빈 Set', () => {
    expect(computeEffectiveActiveIds([], 'cw')).toEqual(new Set())
  })

  it('CCW: 높은 sequenceOrder 먼저 → 역방향 컷오프 적용', () => {
    // CCW 정렬: seq 3 → 2 → 1. seq=2 inactive → seq=3만 active
    const segs = [seg(1, 1, true), seg(2, 2, false), seg(3, 3, true)]
    const result = computeEffectiveActiveIds(segs, 'ccw')
    expect(result).toEqual(new Set([3]))
  })

  it('CCW: 첫 구간(seq=1)이 inactive → seq=3, seq=2까지는 active', () => {
    // CCW 정렬: 3 → 2 → 1. 1(inactive)은 맨 마지막 → 3,2는 active
    const segs = [seg(1, 1, false), seg(2, 2, true), seg(3, 3, true)]
    const result = computeEffectiveActiveIds(segs, 'ccw')
    expect(result).toEqual(new Set([2, 3]))
  })

  it('입력 배열 순서가 뒤섞여 있어도 sequenceOrder 기준으로 정렬', () => {
    // 순서 뒤섞어 전달 — seq 2가 inactive
    const segs = [seg(3, 3, true), seg(1, 1, true), seg(2, 2, false)]
    const result = computeEffectiveActiveIds(segs, 'cw')
    expect(result).toEqual(new Set([1]))
  })
})

// ─── 비활성화 시맨틱: fromTableId vs toTableId ────────────────────────────────
// 핵심 규칙: 클릭한 테이블의 fromTableId segment를 끊으면
//   → 클릭 테이블까지는 음식 도달 (effectiveActive), 이후 테이블은 미도달
//   → 클릭 테이블의 incomingSeg는 여전히 effectiveActive에 포함됨

describe('비활성화 시맨틱 — fromTableId 컷오프', () => {
  // 4개 테이블, seq 순서: 1(toTableId=T1), 2(toTableId=T2), 3(toTableId=T3), 4(toTableId=T4)
  // fromTableId segments: seg1(from=T0→T1), seg2(from=T1→T2), seg3(from=T2→T3), seg4(from=T3→T4)
  // 테이블3 클릭 = from=T3 segment를 inactive
  // = seg3(toTableId=T3)가 effectiveActive에 남아야 함 → 테이블3에 음식 도달
  // = seg4(toTableId=T4)부터 effectiveActive에 없어야 함 → 테이블4부터 미도달

  it('테이블3 클릭 시: 테이블3 incoming seg(seq=3)은 effectiveActive에 포함됨', () => {
    // seg ids: 10=to1, 20=to2, 30=to3, 40=to4(from=T3→T4, 이것이 비활성)
    const segs = [
      seg(10, 1, true),   // toTableId=T1
      seg(20, 2, true),   // toTableId=T2
      seg(30, 3, true),   // toTableId=T3  ← 테이블3의 incoming
      seg(40, 4, false),  // toTableId=T4  ← 테이블3의 outgoing(fromTableId=T3)이 비활성 → 컷오프
    ]
    const result = computeEffectiveActiveIds(segs, 'cw')
    // seq 4가 inactive → 컷오프. seq 1,2,3은 effectiveActive
    expect(result).toEqual(new Set([10, 20, 30]))
    // 테이블3의 incoming seg(id=30)이 effectiveActive에 포함 = 음식 도달 ✓
    expect(result.has(30)).toBe(true)
    // 테이블4의 incoming seg(id=40)은 미포함 = 음식 미도달 ✓
    expect(result.has(40)).toBe(false)
  })

  it('테이블1(첫 번째) 클릭 시: 아무 테이블도 음식 미도달 (seq=1 컷오프)', () => {
    const segs = [
      seg(10, 1, false),  // toTableId=T1, 테이블1 outgoing = 컷오프 = seq=1 inactive
      seg(20, 2, true),
      seg(30, 3, true),
    ]
    // seq=1부터 바로 컷 → effectiveActive 없음
    expect(computeEffectiveActiveIds(segs, 'cw')).toEqual(new Set())
  })

  it('컷오프 해제(isOnlyCutoff=true): 모든 seg active 시 모두 effectiveActive', () => {
    const segs = [seg(10, 1, true), seg(20, 2, true), seg(30, 3, true), seg(40, 4, true)]
    expect(computeEffectiveActiveIds(segs, 'cw')).toEqual(new Set([10, 20, 30, 40]))
  })
})

// ─── computeBeltGeo ─────────────────────────────────────────────────────────

describe('computeBeltGeo', () => {
  it('주방만 있고 테이블 없으면 null 반환', () => {
    const geo = computeBeltGeo([kitchen()], [])
    expect(geo).toBeNull()
  })

  it('주방 원소가 없으면 null 반환', () => {
    const geo = computeBeltGeo([], [table(1, 10, 10)])
    expect(geo).toBeNull()
  })

  it('주방 북쪽에 테이블 있을 때 beltGeo 생성', () => {
    // kitchen: (40,40)~(60,60), table1 북쪽 (40,10)
    const geo = computeBeltGeo([kitchen(40, 40)], [table(1, 40, 10)])
    expect(geo).not.toBeNull()
    expect(geo!.T_TOTAL).toBeGreaterThan(0)
  })

  it('T_TOTAL이 양수이고 구간 경계가 단조증가', () => {
    // kitchen(40,40,20,20), 4방향에 테이블 1개씩
    const tables = [
      table(1, 40, 5),   // 북
      table(2, 70, 40),  // 동
      table(3, 40, 75),  // 남
      table(4, 5, 40),   // 서
    ]
    const geo = computeBeltGeo([kitchen()], tables)
    expect(geo).not.toBeNull()
    const { T_TOP_END, T_RIGHT_START, T_RIGHT_END, T_BOTTOM_START, T_BOTTOM_END, T_LEFT_START, T_LEFT_END, T_TOTAL } = geo!
    expect(T_TOP_END).toBeGreaterThan(0)
    expect(T_RIGHT_START).toBeGreaterThan(T_TOP_END)
    expect(T_RIGHT_END).toBeGreaterThan(T_RIGHT_START)
    expect(T_BOTTOM_START).toBeGreaterThan(T_RIGHT_END)
    expect(T_BOTTOM_END).toBeGreaterThan(T_BOTTOM_START)
    expect(T_LEFT_START).toBeGreaterThan(T_BOTTOM_END)
    expect(T_LEFT_END).toBeGreaterThan(T_LEFT_START)
    expect(T_TOTAL).toBeGreaterThan(T_LEFT_END)
  })
})

// ─── tableToArcT ─────────────────────────────────────────────────────────────

describe('tableToArcT', () => {
  const k = kitchen(40, 40, 20, 20) // x:40-60, y:40-60
  const allTables = [
    table(1, 40, 5),   // 북
    table(2, 70, 40),  // 동
    table(3, 40, 75),  // 남
    table(4, 5, 40),   // 서
  ]

  it('4방향 테이블 arc-t가 0 이상 T_TOTAL 미만', () => {
    const geo = computeBeltGeo([k], allTables)!
    for (const t of allTables) {
      const arcT = tableToArcT(t, geo)
      expect(arcT).toBeGreaterThanOrEqual(0)
      expect(arcT).toBeLessThan(geo.T_TOTAL)
    }
  })

  it('CW 방향: 북(TOP) → 동(RIGHT) → 남(BOTTOM) → 서(LEFT) 순서로 arc-t 증가', () => {
    const geo = computeBeltGeo([k], allTables)!
    const tNorth = tableToArcT(allTables[0], geo) // 북
    const tEast  = tableToArcT(allTables[1], geo) // 동
    const tSouth = tableToArcT(allTables[2], geo) // 남
    const tWest  = tableToArcT(allTables[3], geo) // 서
    // CW: top(0~T_TOP_END) < right(T_RIGHT_START~) < bottom < left
    expect(tNorth).toBeLessThan(tEast)
    expect(tEast).toBeLessThan(tSouth)
    expect(tSouth).toBeLessThan(tWest)
  })

  it('좌표가 null인 테이블 → 0 반환', () => {
    const geo = computeBeltGeo([k], allTables)!
    const nullTable: RestaurantTable = {
      id: 99, seatType: 'TABLE', tableNumber: 99, seatCount: 2,
      status: 'EMPTY', x: null, y: null, width: null, height: null,
    }
    expect(tableToArcT(nullTable, geo)).toBe(0)
  })
})

// ─── computeReorderFromPositions ──────────────────────────────────────────────

describe('computeReorderFromPositions', () => {
  // kitchen(40,40,20,20): 주방 중앙
  const k = kitchen(40, 40, 20, 20)
  // 4방향 테이블: 북(1) 동(2) 남(3) 서(4)
  const tables = [
    table(1, 40, 5),   // 북, arc-t 작음
    table(2, 70, 40),  // 동
    table(3, 40, 75),  // 남
    table(4, 5, 40),   // 서, arc-t 가장 큼
  ]
  // segments: 1→2, 2→3, 3→4, 4→1 (CW 순환)
  const segs: RailSegment[] = [
    { id: 10, sequenceOrder: 99, active: true, fromTableId: 1, toTableId: 2 },
    { id: 20, sequenceOrder: 99, active: true, fromTableId: 2, toTableId: 3 },
    { id: 30, sequenceOrder: 99, active: true, fromTableId: 3, toTableId: 4 },
    { id: 40, sequenceOrder: 99, active: true, fromTableId: 4, toTableId: 1 },
  ]

  it('빈 segments 배열 → 빈 결과', () => {
    const geo = computeBeltGeo([k], tables)!
    expect(computeReorderFromPositions([], tables, geo)).toEqual([])
  })

  it('4방향 순환 레이아웃 → 물리 위치 기반 sequenceOrder 1~4 부여', () => {
    const geo = computeBeltGeo([k], tables)!
    const orders = computeReorderFromPositions(segs, tables, geo)
    expect(orders).toHaveLength(4)
    const orderMap = new Map(orders.map((o) => [o.segmentId, o.sequenceOrder]))
    // 모든 seg가 1~4 범위 안에 있어야 함
    for (const o of orders) {
      expect(o.sequenceOrder).toBeGreaterThanOrEqual(1)
      expect(o.sequenceOrder).toBeLessThanOrEqual(4)
    }
    // 중복 없어야 함
    const values = [...orderMap.values()]
    expect(new Set(values).size).toBe(values.length)
  })

  it('물리 위치 기반 순서: 북→동 segment가 남→서 segment보다 먼저', () => {
    const geo = computeBeltGeo([k], tables)!
    const orders = computeReorderFromPositions(segs, tables, geo)
    const orderMap = new Map(orders.map((o) => [o.segmentId, o.sequenceOrder]))
    // id=10 (1→2, 북→동)이 id=30 (3→4, 남→서)보다 sequenceOrder 작아야 함
    expect(orderMap.get(10)!).toBeLessThan(orderMap.get(30)!)
  })

  it('테이블 위치 변경 시 wrap segment 감지가 바뀌어 sequenceOrder 재배정됨', () => {
    // 원래: 북(1)→동(2)→남(3)→서(4)→[wrap 4→1]→북(1) — id=10 seq=1
    const geo = computeBeltGeo([k], tables)!
    const original = computeReorderFromPositions(segs, tables, geo)
    const origOrder = new Map(original.map((o) => [o.segmentId, o.sequenceOrder]))

    // 북(1)과 서(4)를 교체: 1을 서쪽(5,40)으로, 4를 북쪽(40,5)으로
    // → segment 1→2 가 서→동이 되어 큰 drop 발생, wrap이 4→1에서 1→2로 이동
    // → 순회 시작이 table 2로 바뀌어 id=10의 seq가 1→4로 변경
    const swappedTables = tables.map((t) => {
      if (t.id === 1) return { ...t, x: 5,  y: 40 } // 원래 서 위치
      if (t.id === 4) return { ...t, x: 40, y: 5  } // 원래 북 위치
      return t
    })
    const reordered = computeReorderFromPositions(segs, swappedTables, geo)
    const newOrder  = new Map(reordered.map((o) => [o.segmentId, o.sequenceOrder]))

    // wrap 변경으로 순회 시작이 달라져 id=10 sequenceOrder가 반드시 바뀌어야 함
    expect(origOrder.get(10)).not.toBe(newOrder.get(10))
    // 그리고 id=20 이 새 start → seq=1
    expect(newOrder.get(20)).toBe(1)
  })
})
