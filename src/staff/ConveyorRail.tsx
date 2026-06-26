import { useId } from 'react'
import type { FloorPlanElement } from '../auth/floorPlanElementApi'
import type { RailSegment } from '../auth/railSegmentApi'
import type { RestaurantTable } from '../auth/tableApi'

interface ConveyorRailProps {
  elements: FloorPlanElement[]
  segments: RailSegment[]
  tables: RestaurantTable[]
}

const CORNER_R_OUTER = 3
const CORNER_R_INNER = 1.5
const ARROW_STEP = 5.5
const ARROW_DUR = '1.1s'
const BELT_ACTIVE = '#3ec4b4'
const BELT_INACTIVE = '#cbd5e1'
// belt 두께: 모든 방향 동일 — 실제 gap과 무관하게 균일한 벨트 시각
const BELT_THICKNESS = 4.5
// 화살표 크기: belt 두께와 무관하게 고정
const ARROW_H = 1.1
const ARROW_S = 0.85
const ARROW_ACTIVE = 'rgba(255,255,255,0.72)'
const ARROW_INACTIVE = 'rgba(148,163,184,0.48)'
const LINE_ACTIVE = '#3ec4b4'
const LINE_INACTIVE = '#cbd5e1'
const KITCHEN_GAP = 0.8

function rrPath(x: number, y: number, w: number, h: number, r: number): string {
  const cr = Math.min(r, w / 2, h / 2)
  return [
    `M ${x + cr},${y}`,
    `H ${x + w - cr}`,
    `A ${cr},${cr} 0 0 1 ${x + w},${y + cr}`,
    `V ${y + h - cr}`,
    `A ${cr},${cr} 0 0 1 ${x + w - cr},${y + h}`,
    `H ${x + cr}`,
    `A ${cr},${cr} 0 0 1 ${x},${y + h - cr}`,
    `V ${y + cr}`,
    `A ${cr},${cr} 0 0 1 ${x + cr},${y}`,
    'Z',
  ].join(' ')
}

function ConveyorRail({ elements, segments, tables }: ConveyorRailProps) {
  const rawUid = useId()
  const uid = `cr${rawUid.replace(/[^a-zA-Z0-9]/g, '')}`

  const kitchen = elements.find((e) => e.type === 'KITCHEN')
  if (!kitchen) return null

  const active = segments.some((s) => s.active)

  // kitchen inner boundary (with visual gap from belt)
  const kx = kitchen.x - KITCHEN_GAP
  const ky = kitchen.y - KITCHEN_GAP
  const kw = kitchen.width + KITCHEN_GAP * 2
  const kh = kitchen.height + KITCHEN_GAP * 2
  const kitchenRight = kitchen.x + kitchen.width
  const kitchenBottom = kitchen.y + kitchen.height

  // 방향별 테이블 분류: x 기준 우선(서/동), 나머지만 y 기준(북/남)
  // → 카운터 좌석처럼 kitchen 옆에 길게 늘어선 테이블이 잘못 남/북으로 분류되는 것 방지
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

  // 방향별 belt 두께: 테이블 없는 방향은 0, 있는 방향은 고정 BELT_THICKNESS
  const beltLeft = westTables.length > 0 ? BELT_THICKNESS : 0
  const beltRight = eastTables.length > 0 ? BELT_THICKNESS : 0
  const beltTop = northTables.length > 0 ? BELT_THICKNESS : 0
  const beltBottom = southTables.length > 0 ? BELT_THICKNESS : 0

  // belt가 하나도 없으면 렌더링 생략
  if (beltLeft === 0 && beltRight === 0 && beltTop === 0 && beltBottom === 0) return null

  // rail outer bounds
  const rx = kx - beltLeft
  const ry = ky - beltTop
  const rw = kw + beltLeft + beltRight
  const rh = kh + beltTop + beltBottom

  const topCY = ry + beltTop / 2
  const bottomCY = ky + kh + beltBottom / 2
  const leftCX = rx + beltLeft / 2
  const rightCX = kx + kw + beltRight / 2

  const beltFill = active ? BELT_ACTIVE : BELT_INACTIVE
  const arrowColor = active ? ARROW_ACTIVE : ARROW_INACTIVE
  const lineColor = active ? LINE_ACTIVE : LINE_INACTIVE

  function arrowGroup(
    dir: 'right' | 'down' | 'left' | 'up',
    posMin: number,
    posMax: number,
    orthoCenter: number,
    thick: number,
    clipId: string,
  ) {
    if (thick <= 0) return null
    const isH = dir === 'right' || dir === 'left'
    const len = posMax - posMin
    const count = Math.ceil(len / ARROW_STEP) + 3

    const animTo =
      dir === 'right'
        ? `${ARROW_STEP} 0`
        : dir === 'down'
          ? `0 ${ARROW_STEP}`
          : dir === 'left'
            ? `${-ARROW_STEP} 0`
            : `0 ${-ARROW_STEP}`

    const paths = Array.from({ length: count }, (_, i) => {
      const pos = posMin - ARROW_STEP + i * ARROW_STEP
      const cx = isH ? pos : orthoCenter
      const cy = isH ? orthoCenter : pos
      const d =
        dir === 'right'
          ? `M${cx - ARROW_H},${cy - ARROW_S} L${cx + ARROW_H},${cy} L${cx - ARROW_H},${cy + ARROW_S}`
          : dir === 'down'
            ? `M${cx - ARROW_S},${cy - ARROW_H} L${cx},${cy + ARROW_H} L${cx + ARROW_S},${cy - ARROW_H}`
            : dir === 'left'
              ? `M${cx + ARROW_H},${cy - ARROW_S} L${cx - ARROW_H},${cy} L${cx + ARROW_H},${cy + ARROW_S}`
              : `M${cx - ARROW_S},${cy + ARROW_H} L${cx},${cy - ARROW_H} L${cx + ARROW_S},${cy + ARROW_H}`
      return (
        <path
          key={i}
          d={d}
          stroke={arrowColor}
          strokeWidth="0.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    })

    return (
      <g clipPath={`url(#${clipId})`}>
        <g>
          {paths}
          {active && (
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to={animTo}
              dur={ARROW_DUR}
              repeatCount="indefinite"
            />
          )}
        </g>
      </g>
    )
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={`${uid}t`}>
          <rect x={rx} y={ry} width={rw} height={beltTop} />
        </clipPath>
        <clipPath id={`${uid}r`}>
          <rect x={kx + kw} y={ry} width={beltRight} height={rh} />
        </clipPath>
        <clipPath id={`${uid}b`}>
          <rect x={rx} y={ky + kh} width={rw} height={beltBottom} />
        </clipPath>
        <clipPath id={`${uid}l`}>
          <rect x={rx} y={ry} width={beltLeft} height={rh} />
        </clipPath>
        {active && (
          <filter id={`${uid}g`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Connector lines: table center → nearest point on rail outer edge */}
      {tables.map((t) => {
        if (t.x === null || t.y === null || t.width === null || t.height === null) return null
        const tcx = t.x + t.width / 2
        const tcy = t.y + t.height / 2
        const nearX = Math.max(rx, Math.min(rx + rw, tcx))
        const nearY = Math.max(ry, Math.min(ry + rh, tcy))
        return (
          <line
            key={`c${t.id}`}
            x1={tcx}
            y1={tcy}
            x2={nearX}
            y2={nearY}
            stroke={lineColor}
            strokeWidth="0.45"
            opacity={0.55}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}

      {/* Belt background — donut shape via evenodd fill rule */}
      <path
        d={`${rrPath(rx, ry, rw, rh, CORNER_R_OUTER)} ${rrPath(kx, ky, kw, kh, CORNER_R_INNER)}`}
        fill={beltFill}
        fillRule="evenodd"
        filter={active ? `url(#${uid}g)` : undefined}
        opacity={0.9}
      />

      {/* Arrow patterns: top→right, right→down, bottom→left, left→up */}
      {arrowGroup('right', rx, rx + rw, topCY, beltTop, `${uid}t`)}
      {arrowGroup('down', ry, ry + rh, rightCX, beltRight, `${uid}r`)}
      {arrowGroup('left', rx, rx + rw, bottomCY, beltBottom, `${uid}b`)}
      {arrowGroup('up', ry, ry + rh, leftCX, beltLeft, `${uid}l`)}
    </svg>
  )
}

export default ConveyorRail
