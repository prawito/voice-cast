interface Props {
  levels?: number[]
}

const BAR_COUNT = 5
const MIN_HEIGHT_PX = 4
const MAX_HEIGHT_PX = 20
const SENSITIVITY = 3.2
const IDLE_FLOOR = 0.08

export function WaveAnim({ levels }: Props) {
  const bars = normalize(levels)
  return (
    <div className="flex h-5 items-center gap-[2px]">
      {bars.map((level, i) => {
        const height = MIN_HEIGHT_PX + (MAX_HEIGHT_PX - MIN_HEIGHT_PX) * level
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-rose-400 transition-[height] duration-75"
            style={{ height: `${height}px` }}
          />
        )
      })}
    </div>
  )
}

function normalize(levels?: number[]): number[] {
  if (!levels || levels.length === 0) return new Array(BAR_COUNT).fill(IDLE_FLOOR)
  const out: number[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    const idx = levels.length - BAR_COUNT + i
    const raw = idx >= 0 ? levels[idx] : 0
    const shaped = Math.sqrt(Math.max(0, raw)) * SENSITIVITY
    out.push(Math.max(IDLE_FLOOR, Math.min(1, shaped)))
  }
  return out
}
