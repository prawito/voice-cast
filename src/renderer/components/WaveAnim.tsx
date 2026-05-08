export function WaveAnim() {
  return (
    <div className="flex items-end gap-[2px] h-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-rose-400 animate-[vc-wave_900ms_ease-in-out_infinite]"
          style={{
            animationDelay: `${i * 110}ms`
          }}
        />
      ))}
    </div>
  )
}
