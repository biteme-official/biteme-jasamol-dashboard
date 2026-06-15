"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  Cell,
} from "recharts";

interface ChannelDaily {
  date: string;
  app: number;
  web: number;
}

interface Channel {
  channel: string;
  app: number;
  web: number;
  total: number;
  share: number;
  daily: ChannelDaily[];
}

interface ChannelData {
  channels: Channel[];
  grandTotal: { app: number; web: number; total: number };
}

interface Props {
  start: string;
  end: string;
  label: string;
}

type PlatformFilter = "total" | "app" | "web";

const COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899",
  "#f59e0b", "#06b6d4", "#84cc16", "#ef4444", "#6366f1",
  "#14b8a6", "#e879f9", "#fb923c", "#a3e635", "#38bdf8",
];

const OTHERS_COLOR = "#d1d5db";

function n(v: number): string {
  return v.toLocaleString("ko-KR");
}

function formatDate(d: string): string {
  const parts = d.split("-");
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function getValue(ch: Channel, filter: PlatformFilter): number {
  if (filter === "app") return ch.app;
  if (filter === "web") return ch.web;
  return ch.total;
}

export default function ChannelAnalysis({ start, end, label }: Props) {
  const [data, setData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("total");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels?start=${start}&end=${end}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(
        new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.channels].sort(
      (a, b) => getValue(b, platformFilter) - getValue(a, platformFilter)
    );
  }, [data, platformFilter]);

  const unattributed = sorted.find((c) => c.channel === "unattributed");
  const attributed = sorted.filter((c) => c.channel !== "unattributed");

  const attributedTotal = useMemo(() => {
    return attributed.reduce((s, c) => s + getValue(c, platformFilter), 0);
  }, [attributed, platformFilter]);

  const grandValue = useMemo(() => {
    if (!data) return 0;
    if (platformFilter === "app") return data.grandTotal.app;
    if (platformFilter === "web") return data.grandTotal.web;
    return data.grandTotal.total;
  }, [data, platformFilter]);

  const unattributedShare = grandValue > 0 && unattributed
    ? Math.round((getValue(unattributed, platformFilter) / grandValue) * 10000) / 100
    : 0;

  // Horizontal bar data: top 12 attributed channels
  const barData = useMemo(() => {
    const top = attributed.slice(0, 12);
    const othersVal =
      attributed.slice(12).reduce((s, c) => s + getValue(c, platformFilter), 0);
    const items = top.map((c) => ({
      name: c.channel,
      value: getValue(c, platformFilter),
      share:
        grandValue > 0
          ? Math.round((getValue(c, platformFilter) / grandValue) * 10000) / 100
          : 0,
    }));
    if (othersVal > 0) {
      items.push({
        name: "기타",
        value: othersVal,
        share: grandValue > 0 ? Math.round((othersVal / grandValue) * 10000) / 100 : 0,
      });
    }
    return items;
  }, [attributed, grandValue, platformFilter]);

  // Stacked area data: top 5 channels daily + 기타
  const areaData = useMemo(() => {
    if (!data || attributed.length === 0) return [];
    const top5 = attributed.slice(0, 5);
    const restChannels = attributed.slice(5);
    const dates = top5[0]?.daily.map((d) => d.date) || [];

    return dates.map((date, di) => {
      const row: Record<string, string | number> = { date: formatDate(date) };
      for (const ch of top5) {
        const d = ch.daily[di];
        if (platformFilter === "app") row[ch.channel] = d?.app || 0;
        else if (platformFilter === "web") row[ch.channel] = d?.web || 0;
        else row[ch.channel] = (d?.app || 0) + (d?.web || 0);
      }
      let restVal = 0;
      for (const ch of restChannels) {
        const d = ch.daily[di];
        if (platformFilter === "app") restVal += d?.app || 0;
        else if (platformFilter === "web") restVal += d?.web || 0;
        else restVal += (d?.app || 0) + (d?.web || 0);
      }
      row["기타"] = restVal;
      return row;
    });
  }, [data, attributed, platformFilter]);

  const top5Keys = attributed.slice(0, 5).map((c) => c.channel);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">{label}</h2>
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              마지막 업데이트 {lastUpdated}
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-1.5 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "조회중..." : "새로고침"}
        </button>
      </div>

      {loading && !data ? (
        <div className="text-center py-20 text-gray-400">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3" />
          <p>에어브릿지 채널 데이터 조회 중...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 text-sm mb-2">데이터 조회 실패</p>
          <p className="text-gray-400 text-xs">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Platform filter */}
          <div className="flex gap-1.5">
            {(
              [
                { key: "total", label: "전체" },
                { key: "app", label: "App" },
                { key: "web", label: "Web" },
              ] as { key: PlatformFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPlatformFilter(opt.key)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                  platformFilter === opt.key
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">총 방문자</div>
              <div className="text-xl font-bold text-gray-900 tabular-nums">
                {n(grandValue)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">식별 채널</div>
              <div className="text-xl font-bold text-gray-900 tabular-nums">
                {attributed.length}개
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">식별 유입</div>
              <div className="text-xl font-bold text-orange-600 tabular-nums">
                {n(attributedTotal)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {grandValue > 0
                  ? (100 - unattributedShare).toFixed(1)
                  : 0}
                %
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">미식별 비율</div>
              <div className="text-xl font-bold text-gray-400 tabular-nums">
                {unattributedShare}%
              </div>
            </div>
          </div>

          {/* Channel contribution bar chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">
              채널 기여도 순위
              <span className="font-normal text-gray-400 ml-2 text-xs">
                (unattributed 제외)
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(360, barData.length * 32)}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 60, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v) => [n(Number(v)), "방문자"]}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {barData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i < COLORS.length
                          ? COLORS[i]
                          : OTHERS_COLOR
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily stacked area chart */}
          {areaData.length >= 2 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                일별 채널 기여도 추이
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart
                  data={areaData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [n(Number(v)), ""]} />
                  <Legend />
                  {top5Keys.map((key, i) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stackId="1"
                      fill={COLORS[i]}
                      stroke={COLORS[i]}
                      fillOpacity={0.7}
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="기타"
                    stackId="1"
                    fill={OTHERS_COLOR}
                    stroke={OTHERS_COLOR}
                    fillOpacity={0.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Channel detail table */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">
              채널 상세
            </h3>

            {/* Table header */}
            <div className="flex items-center gap-3 px-1 pb-2 border-b border-gray-200 text-xs text-gray-400">
              <span className="w-6 text-right shrink-0">#</span>
              <span className="flex-1">채널</span>
              <span className="w-16 text-right shrink-0">App</span>
              <span className="w-16 text-right shrink-0">Web</span>
              <span className="w-16 text-right shrink-0">합계</span>
              <span className="w-14 text-right shrink-0">기여도</span>
            </div>

            <div className="divide-y divide-gray-100">
              {sorted.slice(0, 30).map((ch, i) => {
                const val = getValue(ch, platformFilter);
                const share =
                  grandValue > 0
                    ? Math.round((val / grandValue) * 10000) / 100
                    : 0;
                const isUnattr = ch.channel === "unattributed";
                return (
                  <div
                    key={ch.channel}
                    className={`flex items-center gap-3 py-2.5 ${
                      isUnattr ? "bg-gray-50 -mx-5 px-5" : ""
                    }`}
                  >
                    <span className="text-sm font-bold text-gray-300 w-6 text-right shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span
                        className={`text-sm font-medium truncate ${
                          isUnattr ? "text-gray-400" : "text-gray-800"
                        }`}
                      >
                        {ch.channel}
                      </span>
                      {isUnattr && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 shrink-0">
                          미식별
                        </span>
                      )}
                    </div>
                    <span className="w-16 text-right text-sm tabular-nums text-gray-500 shrink-0">
                      {n(ch.app)}
                    </span>
                    <span className="w-16 text-right text-sm tabular-nums text-gray-500 shrink-0">
                      {n(ch.web)}
                    </span>
                    <span className="w-16 text-right text-sm tabular-nums font-medium text-gray-900 shrink-0">
                      {n(ch.total)}
                    </span>
                    <div className="w-14 text-right shrink-0">
                      <span
                        className={`text-sm tabular-nums font-medium ${
                          share >= 5
                            ? "text-orange-600"
                            : share >= 1
                            ? "text-gray-700"
                            : "text-gray-400"
                        }`}
                      >
                        {share}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
