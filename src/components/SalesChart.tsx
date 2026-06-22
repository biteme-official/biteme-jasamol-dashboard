"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface DailyData {
  date: string;
  sales: number;
  orders: number;
}

interface HourlyData {
  hour: number;
  sales: number;
  orders: number;
}

interface Props {
  daily: DailyData[];
  hourly?: HourlyData[] | null;
  compareDaily?: DailyData[] | null;
  compareHourly?: HourlyData[] | null;
}

function formatDate(d: string): string {
  const parts = d.split("-");
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function formatKRW(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export default function SalesChart({ daily, hourly, compareDaily, compareHourly }: Props) {
  const isHourly = !!hourly;

  if (isHourly) {
    const merged = hourly.map((d) => ({
      label: `${d.hour}시`,
      매출: d.sales,
      ...(compareHourly?.[d.hour] ? { 비교매출: compareHourly[d.hour].sales } : {}),
    }));

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">시간별 매출 추이</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={merged} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatKRW} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v, name) => [
                `${Number(v).toLocaleString("ko-KR")}원`,
                name,
              ]}
            />
            <Legend />
            {compareHourly && (
              <Bar dataKey="비교매출" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
            )}
            <Bar dataKey="매출" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (!daily.length || daily.length < 2) return null;

  const merged = daily.map((d, i) => ({
    label: formatDate(d.date),
    매출: d.sales,
    ...(compareDaily?.[i] ? { 비교매출: compareDaily[i].sales } : {}),
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4">일별 매출 추이</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={merged} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatKRW} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v, name) => [
              `${Number(v).toLocaleString("ko-KR")}원`,
              name,
            ]}
          />
          <Legend />
          {compareDaily && (
            <Bar dataKey="비교매출" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
          )}
          <Bar dataKey="매출" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
