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
const BELT_ACTIVE = '#3ec4b4'
const BELT_INACTIVE = '#cbd5e1'
const BELT_THICKNESS = 4.5
const ARROW_H = 1.1
const ARROW_S = 0.85
const ARROW_COLOR = 'rgba(255,255,255,0.72)'
const LINE_ACTIVE = '#3ec4b4'
const LINE_INACTIVE = '#cbd5e1'
const KITCHEN_GAP = 0.8
const BELT_SPEED = 5 // viewbox units / second

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

// belt 중앙선 closed path — animateMotion이 이 경로를 따라 화살표를 이동시킴
// 코너 radius = BELT_THICKNESS/2 → 자연스러운 곡선 전환
function beltCenterPath(rx: number, ry: number, rw: number, rh: number, th: number): string {
  const r = th / 2
  return [
    `M ${rx + th},${ry + r}`,
    `H ${rx + rw - th}`,
    `A ${r},${r} 0 0 1 ${rx + rw - r},${ry + th}`,
    `V ${ry + rh - th}`,
    `A ${r},${r} 0 0 1 ${rx + rw - th},${ry + rh - r}`,
    `H ${rx + th}`,
    `A ${r},${r} 0 0 1 ${rx + r},${ry + rh - th}`,
    `V ${ry + th}`,
    `A ${r},${r} 0 0 1 ${rx + th},${ry + r}`,
    'Z',
  ].join(' ')
}

function ConveyorRail({ elements, segments, tables }: ConveyorRailProps) {
  const rawUid = useId()
  const uid = `cr${rawUid.replace(/[^a-zA-Z0-9]/g, '')}`

  const kitchen = elements.find((e) => e.type === 'KITCHEN')
  if (!kitchen) return null

  const active = segments.some((s) => s.active)

  const kx = kitchen.x - KITCHEN_GAP
  const ky = kitchen.y - KITCHEN_GAP
  const kw = kitchen.width + KITCHEN_GAP * 2
  const kh = kitchen.height + KITCHEN_GAP * 2
  const kitchenRight = kitchen.x + kitchen.width
  const kitchenBottom = kitchen.y + kitchen.height

  // x 기준 우선 분류(서/동), 나머지만 y 기준(북/남)
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

  const beltLeft = westTables.length > 0 ? BELT_THICKNESS : 0
  const beltRight = eastTables.length > 0 ? BELT_THICKNESS : 0
  const beltTop = northTables.length > 0 ? BELT_THICKNESS : 0
  const beltBottom = southTables.length > 0 ? BELT_THICKNESS : 0

  if (beltLeft === 0 && beltRight === 0 && beltTop === 0 && beltBottom === 0) return null

  const rx = kx - beltLeft
  const ry = ky - beltTop
  const rw = kw + beltLeft + beltRight
  const rh = kh + beltTop + beltBottom

  const beltFill = active ? BELT_ACTIVE : BELT_INACTIVE
  const lineColor = active ? LINE_ACTIVE : LINE_INACTIVE

  // 경로 길이 계산 → 화살표 수 · 애니메이션 총 시간
  const straightLen = 2 * (rw - 2 * BELT_THICKNESS + rh - 2 * BELT_THICKNESS)
  const cornerLen = Math.PI * BELT_THICKNESS // 4 * (π/2 * r)
  const pathLen = straightLen + cornerLen
  const totalDur = pathLen / BELT_SPEED
  const arrowCount = Math.ceil(pathLen / ARROW_STEP)
  const centerPath = beltCenterPath(rx, ry, rw, rh, BELT_THICKNESS)

  // 화살표 d: 원점 기준 오른쪽(→) 방향 — rotate="auto"가 경로에 맞게 회전
  const arrowD = `M ${-ARROW_H},${-ARROW_S} L ${ARROW_H},0 L ${-ARROW_H},${ARROW_S}`

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {/* belt 도넛 clipPath — kitchen 영역(남쪽 포함)을 지나는 화살표를 가림 */}
        <clipPath id={`${uid}belt`}>
          <path
            d={`${rrPath(rx, ry, rw, rh, CORNER_R_OUTER)} ${rrPath(kx, ky, kw, kh, CORNER_R_INNER)}`}
            clipRule="evenodd"
          />
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

      {/* Belt donut background */}
      <path
        d={`${rrPath(rx, ry, rw, rh, CORNER_R_OUTER)} ${rrPath(kx, ky, kw, kh, CORNER_R_INNER)}`}
        fill={beltFill}
        fillRule="evenodd"
        filter={active ? `url(#${uid}g)` : undefined}
        opacity={0.9}
      />

      {/* Arrows: animateMotion along center path — rotate="auto" handles corner turns */}
      {active && (
        <g clipPath={`url(#${uid}belt)`}>
          {Array.from({ length: arrowCount }, (_, i) => (
            <path
              key={i}
              d={arrowD}
              stroke={ARROW_COLOR}
              strokeWidth="0.7"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <animateMotion
                path={centerPath}
                dur={`${totalDur}s`}
                begin={`${-(i / arrowCount) * totalDur}s`}
                repeatCount="indefinite"
                rotate="auto"
              />
            </path>
          ))}
        </g>
      )}
    </svg>
  )
}

export default ConveyorRail
