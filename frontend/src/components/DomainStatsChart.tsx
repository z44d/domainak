import { memo, useMemo } from "react";
import type { Stats } from "../lib/types";
import { formatNumber } from "../lib/utils";

const chartHeight = 224;
const chartWidth = 720;
const padding = {
  top: 12,
  right: 12,
  bottom: 32,
  left: 44,
};

function formatTick(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${value}`;
}

function DomainStatsChart({
  chartData,
}: {
  chartData: Stats["chartData"];
}) {
  const chart = useMemo(() => {
    const values = chartData.map((item) => item.visitors);
    const maxValue = Math.max(...values, 0);
    const roundedMax = maxValue <= 0 ? 1 : Math.ceil(maxValue / 5) * 5;
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    const columnGap = 14;
    const barWidth =
      chartData.length > 0
        ? (innerWidth - columnGap * (chartData.length - 1)) /
          chartData.length
        : innerWidth;

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const value = Math.round(roundedMax * (1 - ratio));
      const y = padding.top + innerHeight * ratio;

      return {
        value,
        y,
      };
    });

    const bars = chartData.map((item, index) => {
      const x = padding.left + index * (barWidth + columnGap);
      const height = (item.visitors / roundedMax) * innerHeight;
      const y = padding.top + innerHeight - height;

      return {
        ...item,
        x,
        y,
        width: Math.max(12, barWidth),
        height,
      };
    });

    return {
      bars,
      yTicks,
      baselineY: padding.top + innerHeight,
      innerHeight,
    };
  }, [chartData]);

  return (
    <div className="stats-chart" aria-label="Monthly visitors bar chart">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="stats-chart__svg"
        role="img"
        aria-hidden="true"
      >
        {chart.yTicks.map((tick) => (
          <g key={`${tick.value}-${tick.y}`}>
            <line
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={tick.y}
              y2={tick.y}
              className="stats-chart__grid"
            />
            <text
              x={padding.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              className="stats-chart__axis"
            >
              {formatTick(tick.value)}
            </text>
          </g>
        ))}

        {chart.bars.map((bar) => (
          <g key={bar.name}>
            <title>{`${bar.name}: ${formatNumber(bar.visitors)} visitors`}</title>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={Math.max(0, bar.height)}
              rx="6"
              ry="6"
              className="stats-chart__bar"
            />
            <text
              x={bar.x + bar.width / 2}
              y={chart.baselineY + 20}
              textAnchor="middle"
              className="stats-chart__axis"
            >
              {bar.name}
            </text>
          </g>
        ))}
      </svg>

      <div className="stats-chart__fallback" aria-hidden="true">
        {chartData.map((item) => (
          <div key={item.name} className="stats-chart__row">
            <span>{item.name}</span>
            <strong>{formatNumber(item.visitors)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(DomainStatsChart);
