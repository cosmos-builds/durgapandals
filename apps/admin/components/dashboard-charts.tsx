"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

// Dark-mode chart chrome shared by every chart below — recessive gridlines,
// muted axis text, a tooltip that matches the app's card surface. Kept in
// one place so the four charts read as one system (per the dataviz skill's
// "assign color last, style axes/tooltip consistently" guidance).
const AXIS_STYLE = { fontSize: 12, fill: "#A79FB0", fontFamily: "'DM Sans', sans-serif" };
const GRID_STROKE = "rgba(255,255,255,.08)";
const TOOLTIP_STYLE = {
  background: "#221C2B",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 12,
  color: "#F4EFF6",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
};

export function SubmissionsTimeseriesChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_STYLE}
          tickFormatter={(d: string) => d.slice(5)}
          interval="preserveStartEnd"
          axisLine={{ stroke: GRID_STROKE }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#A79FB0" }} />
        <Line type="monotone" dataKey="count" name="Submissions" stroke="#FF4433" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Fixed, validated categorical order (node scripts/validate_palette.js
// confirms all six checks pass for this exact sequence) — a status must
// always land on the same color, and reordering here would break that.
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#2E7FD9",
  REJECTED: "#FF4433",
  MERGED: "#8B6FD1",
  APPROVED: "#B8790A",
};
const STATUS_ORDER = ["PENDING", "REJECTED", "MERGED", "APPROVED"];

export function StatusBreakdownChart({ data }: { data: { status: string; count: number }[] }) {
  const ordered = STATUS_ORDER.map((status) => data.find((d) => d.status === status) ?? { status, count: 0 }).filter(
    (d) => d.count > 0 || data.some((x) => x.status === d.status)
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={ordered} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="status" tick={AXIS_STYLE} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#A79FB0" }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
        <Bar dataKey="count" name="Submissions" radius={[4, 4, 0, 0]}>
          {ordered.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#A79FB0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LikesLeaderboardChart({ data }: { data: { canonicalName: string; likes: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="canonicalName"
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#A79FB0" }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
        <Bar dataKey="likes" name="Likes" fill="#FFB547" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopLocalitiesChart({ data }: { data: { locality: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="locality" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={140} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#A79FB0" }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
        <Bar dataKey="count" name="Submissions" fill="#FF4433" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
