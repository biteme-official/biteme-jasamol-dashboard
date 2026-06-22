"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays, differenceInDays } from "date-fns";
import PeriodSelector from "@/components/PeriodSelector";
import CompareSelector from "@/components/CompareSelector";
import KPICard from "@/components/KPICard";
import PartBreakdown from "@/components/PartBreakdown";
import SalesChart from "@/components/SalesChart";

interface PartData {
  sales: number;
  orders: number;
  buyers: number;
  aov: number;
}

interface SalesData {
  totalSales: number;
  totalOrders: number;
  totalBuyers: number;
  aov: number;
  parts: Record<string, PartData>;
  daily: { date: string; sales: number; orders: number }[];
  hourly: { hour: number; sales: number; orders: number }[] | null;
}

interface DAUData {
  totalDAU: number;
  totalApp: number;
  totalWeb: number;
  avgDAU: number;
  daily: { date: string; app: number; web: number; total: number }[];
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

function n(v: number): string {
  return v.toLocaleString("ko-KR");
}

function diffPct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export default function Dashboard() {
  const [start, setStart] = useState(fmt(new Date()));
  const [end, setEnd] = useState(fmt(new Date()));
  const [label, setLabel] = useState("오늘");

  const defaultCompare = () => {
    const s = new Date();
    const e = new Date();
    const days = differenceInDays(e, s);
    return {
      start: fmt(subDays(s, days + 1)),
      end: fmt(subDays(s, 1)),
    };
  };

  const [compareStart, setCompareStart] = useState<string | null>(defaultCompare().start);
  const [compareEnd, setCompareEnd] = useState<string | null>(defaultCompare().end);
  const [compareLabel, setCompareLabel] = useState("전기간");

  const [data, setData] = useState<SalesData | null>(null);
  const [compare, setCompare] = useState<SalesData | null>(null);
  const [dau, setDau] = useState<DAUData | null>(null);
  const [dauCompare, setDauCompare] = useState<DAUData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start, end });
      if (compareStart && compareEnd) {
        params.set("compareStart", compareStart);
        params.set("compareEnd", compareEnd);
      }

      const [salesRes, dauRes] = await Promise.all([
        fetch(`/api/sales?${params}`),
        fetch(`/api/dau?${params}`),
      ]);

      const salesJson = await salesRes.json();
      setData(salesJson.current);
      setCompare(salesJson.compare);

      if (dauRes.ok) {
        const dauJson = await dauRes.json();
        setDau(dauJson.current);
        setDauCompare(dauJson.compare);
      }

      setLastUpdated(format(new Date(), "HH:mm:ss"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [start, end, compareStart, compareEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  function handlePeriod(s: string, e: string, l: string) {
    setStart(s);
    setEnd(e);
    setLabel(l);
  }

  function handleCompare(cs: string | null, ce: string | null, lbl: string) {
    setCompareStart(cs);
    setCompareEnd(ce);
    setCompareLabel(lbl);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">BITEME</h1>
            <span className="text-sm text-gray-400">Analytics · 자사몰</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <PeriodSelector onSelect={handlePeriod} />
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-1.5 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "조회중..." : "새로고침"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-800">{label}</h2>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                마지막 업데이트 {lastUpdated}
              </span>
            )}
          </div>
          <CompareSelector
            mainStart={start}
            mainEnd={end}
            periodLabel={label}
            onChange={handleCompare}
          />
        </div>

        {compare && compareLabel && (
          <div className="text-xs text-gray-500 bg-gray-100 rounded-md px-3 py-1.5 inline-block">
            vs {compareLabel}
          </div>
        )}

        {loading && !data ? (
          <div className="text-center py-20 text-gray-400">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3" />
            <p>DB 조회 중... (10~20초)</p>
          </div>
        ) : data ? (
          <>
            {/* KPI Cards - 매출 + DAU */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPICard
                label="총 매출"
                value={`${n(data.totalSales)}원`}
                diff={compare ? diffPct(data.totalSales, compare.totalSales) : null}
              />
              <KPICard
                label="주문 수"
                value={`${n(data.totalOrders)}건`}
                diff={compare ? diffPct(data.totalOrders, compare.totalOrders) : null}
              />
              <KPICard
                label="평균 주문금액"
                value={`${n(data.aov)}원`}
                diff={compare ? diffPct(data.aov, compare.aov) : null}
              />
              <KPICard
                label="구매자 수"
                value={`${n(data.totalBuyers)}명`}
                diff={compare ? diffPct(data.totalBuyers, compare.totalBuyers) : null}
              />
              <KPICard
                label="DAU"
                value={dau ? `${n(dau.totalDAU)}명` : "-"}
                sub={dau && dau.daily.length > 1 ? `일평균 ${n(dau.avgDAU)}명` : dau ? `App ${n(dau.totalApp)} · Web ${n(dau.totalWeb)}` : "Airbridge 연동중"}
                diff={dau && dauCompare ? diffPct(dau.totalDAU, dauCompare.totalDAU) : null}
              />
            </div>

            <PartBreakdown
              parts={data.parts}
              compareParts={compare?.parts}
            />

            <SalesChart
              daily={data.daily}
              hourly={data.hourly}
              compareDaily={compare?.daily}
              compareHourly={compare?.hourly}
            />
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            데이터를 불러올 수 없습니다
          </div>
        )}
      </main>
    </div>
  );
}
