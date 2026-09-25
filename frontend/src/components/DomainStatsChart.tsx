import { Box, Divider, Stack, Typography, useTheme } from "@mui/material";
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
  const theme = useTheme();
  const gridColor = theme.palette.divider;
  const axisColor = theme.palette.text.secondary;
  const barColor = theme.palette.primary.main;

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
    <Box
      aria-label="Monthly visitors bar chart"
      sx={{ height: "100%", minHeight: 180 }}
    >
      <Box
        component="svg"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
        sx={{
          width: "100%",
          height: "100%",
          overflow: "visible",
          display: { xs: "none", sm: "block" },
        }}
      >
        {chart.yTicks.map((tick) => (
          <g key={`${tick.value}-${tick.y}`}>
            <line
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={tick.y}
              y2={tick.y}
              stroke={gridColor}
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill={axisColor}
              fontSize="12"
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
              fill={barColor}
            />
            <text
              x={bar.x + bar.width / 2}
              y={chart.baselineY + 20}
              textAnchor="middle"
              fill={axisColor}
              fontSize="12"
            >
              {bar.name}
            </text>
          </g>
        ))}
      </Box>

      <Stack
        divider={<Divider />}
        aria-hidden="true"
        sx={{ display: { xs: "flex", sm: "none" } }}
      >
        {chartData.map((item) => (
          <Box
            key={item.name}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
              py: 1,
            }}
          >
            <Typography variant="body2" color="textSecondary">
              {item.name}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {formatNumber(item.visitors)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default memo(DomainStatsChart);
