import { useId } from 'react'
import type { FloorPlanElement } from '../auth/floorPlanElementApi'
import type { RailSegment } from '../auth/railSegmentApi'
import type { RestaurantTable } from '../auth/tableApi'
import { computeBeltGeo, computeEffectiveActiveIds, tableToArcT } from './railGeometry'

interface ConveyorRailProps {
  elements: FloorPlanElement[]
  segments: RailSegment[]
  tables: RestaurantTable[]
  direction?: 'cw' | 'ccw'
}

const CORNER_R_OUTER = 3
const CORNER_R_INNER = 1.5
const ARROW_STEP = 5.5
const BELT_ACTIVE = '#22c55e'
const BELT_INACTIVE = '#cbd5e1'
const ARROW_H = 1.1
const ARROW_S = 0.85
const ARROW_COLOR = 'rgba(255,255,255,0.72)'
const LINE_ACTIVE = '#22c55e'
const LINE_INACTIVE = '#cbd5e1'
const BELT_SPEED = 5

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

// belt 중앙선 CW closed path — 대시배열 세그먼트 색칠 및 CW 화살표 애니메이션용
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

// belt 중앙선 CCW path — 같은 시작점에서 역방향(반시계) 화살표 애니메이션용
function beltCenterPathCCW(rx: number, ry: number, rw: number, rh: number, th: number): string {
  const r = th / 2
  return [
    `M ${rx + th},${ry + r}`,
    `A ${r},${r} 0 0 0 ${rx + r},${ry + th}`,
    `V ${ry + rh - th}`,
    `A ${r},${r} 0 0 0 ${rx + th},${ry + rh - r}`,
    `H ${rx + rw - th}`,
    `A ${r},${r} 0 0 0 ${rx + rw - r},${ry + rh - th}`,
    `V ${ry + th}`,
    `A ${r},${r} 0 0 0 ${rx + rw - th},${ry + r}`,
    `H ${rx + th}`,
    'Z',
  ].join(' ')
}

function ConveyorRail({ elements, segments, tables, direction = 'cw' }: ConveyorRailProps) {
  const rawUid = useId()
  const uid = `cr${rawUid.replace(/[^a-zA-Z0-9]/g, '')}`

  const geo = computeBeltGeo(elements, tables)
  if (!geo) return null

  const { kx, ky, kw, kh, rx, ry, rw, rh, th, T_TOTAL } = geo

  const effectiveActiveIds = computeEffectiveActiveIds(segments, direction)

  const segData = segments.flatMap((seg) => {
    const fromTable = tables.find((t) => t.id === seg.fromTableId)
    const toTable = tables.find((t) => t.id === seg.toTableId)
    if (!fromTable || !toTable) return []
    const t1 = tableToArcT(fromTable, geo)
    const t2 = tableToArcT(toTable, geo)
    const segLen = t2 > t1 ? t2 - t1 : T_TOTAL - t1 + t2
    if (segLen < 0.01) return []
    return [{ ...seg, effectiveActive: effectiveActiveIds.has(seg.id), t1, segLen }]
  })

  const anyActive = segData.some((s) => s.effectiveActive)

  const centerPath = beltCenterPath(rx, ry, rw, rh, th)
  const animPath = direction === 'ccw' ? beltCenterPathCCW(rx, ry, rw, rh, th) : centerPath
  const totalDur = T_TOTAL / BELT_SPEED
  const arrowCount = Math.ceil(T_TOTAL / ARROW_STEP)
  const arrowD = `M ${-ARROW_H},${-ARROW_S} L ${ARROW_H},0 L ${-ARROW_H},${ARROW_S}`

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {/* 도넛 clipPath — kitchen 영역을 가려 화살표가 내부에 들어가지 않게 */}
        <clipPath id={`${uid}belt`}>
          <path
            d={`${rrPath(rx, ry, rw, rh, CORNER_R_OUTER)} ${rrPath(kx, ky, kw, kh, CORNER_R_INNER)}`}
            clipRule="evenodd"
          />
        </clipPath>

        {anyActive && (
          <filter id={`${uid}g`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}

        {/* 화살표 마스크 — effectiveActive 구간만 흰색, 나머지 검정 */}
        {anyActive && (
          <mask id={`${uid}arm`}>
            <rect x="0" y="0" width="100" height="100" fill="black" />
            {segData
              .filter((s) => s.effectiveActive)
              .map((seg) => (
                <path
                  key={seg.id}
                  d={centerPath}
                  fill="none"
                  stroke="white"
                  strokeWidth={th + 1}
                  strokeDasharray={`${seg.segLen} ${T_TOTAL - seg.segLen}`}
                  strokeDashoffset={T_TOTAL - seg.t1}
                />
              ))}
          </mask>
        )}
      </defs>

      {/* 테이블 → 벨트 연결선 (active 여부에 따라 색상) */}
      {tables.map((t) => {
        if (t.x === null || t.y === null || t.width === null || t.height === null) return null
        const tcx = t.x + t.width / 2
        const tcy = t.y + t.height / 2
        const nearX = Math.max(rx, Math.min(rx + rw, tcx))
        const nearY = Math.max(ry, Math.min(ry + rh, tcy))
        const isActive = segData.some(
          (s) => (s.fromTableId === t.id || s.toTableId === t.id) && s.effectiveActive,
        )
        return (
          <line
            key={`c${t.id}`}
            x1={tcx}
            y1={tcy}
            x2={nearX}
            y2={nearY}
            stroke={isActive ? LINE_ACTIVE : LINE_INACTIVE}
            strokeWidth="0.45"
            opacity={0.55}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}

      {/* 벨트 배경 — 항상 회색 */}
      <path
        d={`${rrPath(rx, ry, rw, rh, CORNER_R_OUTER)} ${rrPath(kx, ky, kw, kh, CORNER_R_INNER)}`}
        fill={BELT_INACTIVE}
        fillRule="evenodd"
        opacity={0.9}
      />

      {/* effectiveActive 구간 오버레이 — dasharray로 해당 구간만 착색 */}
      {segData
        .filter((s) => s.effectiveActive)
        .map((seg) => (
          <path
            key={seg.id}
            d={centerPath}
            fill="none"
            stroke={BELT_ACTIVE}
            strokeWidth={th}
            strokeDasharray={`${seg.segLen} ${T_TOTAL - seg.segLen}`}
            strokeDashoffset={T_TOTAL - seg.t1}
            clipPath={`url(#${uid}belt)`}
            filter={`url(#${uid}g)`}
            opacity={0.9}
          />
        ))}

      {/* 화살표 — active 구간에서만 보이도록 mask 적용 */}
      {anyActive && (
        <g clipPath={`url(#${uid}belt)`} mask={`url(#${uid}arm)`}>
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
                path={animPath}
                dur={`${totalDur}s`}
                begin={`${-(i / arrowCount) * totalDur}s`}
                repeatCount="indefinite"
                rotate="auto"
                keyPoints="0;1"
                keyTimes="0;1"
              />
            </path>
          ))}
        </g>
      )}
    </svg>
  )
}

export default ConveyorRail
