import type { RailSegment } from '../auth/railSegmentApi'
import type { RestaurantTable } from '../auth/tableApi'

interface RailLinesProps {
  tables: RestaurantTable[]
  segments: RailSegment[]
}

function centerOf(table: RestaurantTable | undefined): { x: number; y: number } | null {
  if (!table || table.x === null || table.y === null || table.width === null || table.height === null) return null
  return { x: table.x + table.width / 2, y: table.y + table.height / 2 }
}

function RailLines({ tables, segments }: RailLinesProps) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {segments.map((segment) => {
        const from = centerOf(tables.find((t) => t.id === segment.fromTableId))
        const to = centerOf(tables.find((t) => t.id === segment.toTableId))
        if (!from || !to) return null
        return (
          <line
            key={segment.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={segment.active ? '#22c55e' : '#cbd5e1'}
            strokeWidth={1.2}
            strokeDasharray={segment.active ? undefined : '2 2'}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}

export default RailLines
