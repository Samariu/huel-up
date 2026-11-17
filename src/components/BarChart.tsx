export function BarChart(props: { data: { key: string; ts: number; count: number }[]; height?: number }) {
  const { data, height = 120 } = props;
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 100 / data.length;
  const gap = Math.min(0.6, w * 0.25);
  const ticks = max <= 4 ? Array.from({ length: max }, (_, i) => i + 1) : [Math.ceil(max / 2), max];
  return (
    <div class="chart">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" role="img" aria-label="Drinks per day">
        {ticks.map((t) => (
          <line key={t} class="chart-grid" x1="0" x2="100" y1={height - (t / max) * (height - 4)} y2={height - (t / max) * (height - 4)} />
        ))}
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 4);
          return (
            <rect
              key={d.key}
              class={`chart-bar${i === data.length - 1 ? ' today' : ''}`}
              x={i * w + gap / 2}
              y={height - h}
              width={w - gap}
              height={Math.max(h, d.count ? 1 : 0)}
            >
              <title>
                {new Date(d.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: {d.count}
              </title>
            </rect>
          );
        })}
      </svg>
      <div class="chart-axis">
        <span>{fmt(data[0]?.ts)}</span>
        <span>max {max}/day</span>
        <span>today</span>
      </div>
    </div>
  );
}

const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
