import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Stats } from "../lib/types";

export default function DomainStatsChart({
  chartData,
}: {
  chartData: Stats["chartData"];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--chart-grid)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="var(--chart-axis)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          stroke="var(--chart-axis)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) =>
            value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
          }
        />
        <Tooltip
          cursor={{
            fill: "color-mix(in oklab, var(--accent-soft) 70%, transparent)",
          }}
          contentStyle={{
            backgroundColor: "var(--chart-surface)",
            borderColor: "var(--chart-tooltip-border)",
            borderRadius: "8px",
            color: "var(--text)",
          }}
          itemStyle={{ color: "var(--accent)", fontWeight: 600 }}
        />
        <Bar
          dataKey="visitors"
          fill="var(--chart-bar)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
