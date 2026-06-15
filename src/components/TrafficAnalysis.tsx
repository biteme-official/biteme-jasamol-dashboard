"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BrandItem {
  name: string;
  part: string;
  views: number;
  purchases: number;
  cvr: number;
}

interface ProductItem {
  name: string;
  brand_nm: string;
  part: string;
  views: number;
  purchases: number;
  cvr: number;
}

interface DailyItem {
  date: string;
  viewers: number;
  buyers: number;
  cvr: number;
  totalViews: number;
  avgViews: number;
}

interface FunnelStep {
  label: string;
  count: number;
  overallRate: number;
  stepRate: number;
  dropoff: number;
}

interface FunnelData {
  steps: FunnelStep[];
  daily: { date: string; viewers: number; buyers: number; cvr: number }[];
}

interface PromotionItem {
  name: string;
  steps: { label: string; count: number; rate: number }[];
  entry: number;
  final: number;
  cvr: number;
}

interface PromotionFunnelData {
  stepLabels: string[];
  promotions: PromotionItem[];
}

interface TrafficData {
  summary: {
    viewers: number;
    buyers: number;
    cvr: number;
    totalViews: number;
    avgViewsPerUser: number;
  };
  daily: DailyItem[];
  brands: BrandItem[];
  products: ProductItem[];
}

interface Props {
  start: string;
  end: string;
  label: string;
}

type ViewTab = "brand" | "product";
type PartFilter = "전체" | "PB" | "사입" | "위탁";
type SortKey = "views" | "purchases" | "cvr";

const PART_FILTERS: PartFilter[] = ["전체", "PB", "사입", "위탁"];
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views", label: "조회자" },
  { key: "purchases", label: "구매자" },
  { key: "cvr", label: "CVR" },
];

const PAGE_SIZE = 10;
const MAX_ITEMS = 30;

function formatDate(d: string): string {
  const parts = d.split("-");
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

const PART_BADGE: Record<string, string> = {
  PB: "bg-orange-100 text-orange-700",
  사입: "bg-blue-100 text-blue-700",
  위탁: "bg-emerald-100 text-emerald-700",
  미분류: "bg-gray-100 text-gray-600",
};

function n(v: number): string {
  return v.toLocaleString("ko-KR");
}

export default function TrafficAnalysis({ start, end, label }: Props) {
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");

  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [promoFunnel, setPromoFunnel] = useState<PromotionFunnelData | null>(null);
  const [promoSort, setPromoSort] = useState<"entry" | "cvr">("entry");

  const [viewTab, setViewTab] = useState<ViewTab>("brand");
  const [partFilter, setPartFilter] = useState<PartFilter>("전체");
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/amplitude/traffic?start=${start}&end=${end}`
      );
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

  const fetchFunnel = useCallback(async () => {
    setFunnelLoading(true);
    try {
      const [funnelRes, promoRes] = await Promise.all([
        fetch(`/api/amplitude/funnel?start=${start}&end=${end}`),
        fetch(`/api/amplitude/promotion-funnel?start=${start}&end=${end}`),
      ]);
      if (funnelRes.ok) {
        setFunnel(await funnelRes.json());
      }
      if (promoRes.ok) {
        setPromoFunnel(await promoRes.json());
      }
    } catch (e) {
      console.warn("Funnel fetch failed:", e);
    } finally {
      setFunnelLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    fetchData();
    fetchFunnel();
  }, [fetchData, fetchFunnel]);

  const items = useMemo(() => {
    if (!data) return [];
    const source = viewTab === "brand" ? data.brands : data.products;
    const filtered =
      partFilter === "전체"
        ? source
        : source.filter((item) => item.part === partFilter);
    return [...filtered]
      .sort((a, b) => b[sortKey] - a[sortKey])
      .slice(0, MAX_ITEMS);
  }, [data, viewTab, partFilter, sortKey]);

  const totalPages = Math.min(3, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const pageItems = items.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  function changePart(pf: PartFilter) {
    setPartFilter(pf);
    setPage(0);
  }

  function changeSort(sk: SortKey) {
    setSortKey(sk);
    setPage(0);
  }

  function changeTab(tab: ViewTab) {
    setViewTab(tab);
    setPage(0);
  }

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
          <p>Amplitude + RDS 데이터 조회 중...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 text-sm mb-2">데이터 조회 실패</p>
          <p className="text-gray-400 text-xs">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Purchase Funnel */}
          {funnel && funnel.steps.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-gray-700">구매 퍼널</h3>
                <span className="text-[10px] text-gray-400">
                  전환 윈도우 24시간 · ordered
                </span>
              </div>
              <div className="space-y-2.5">
                {funnel.steps.map((step, i) => {
                  const maxCount = funnel.steps[0].count;
                  const widthPct =
                    maxCount > 0
                      ? Math.max(8, (step.count / maxCount) * 100)
                      : 0;
                  const colors = [
                    "from-orange-500 to-orange-400",
                    "from-amber-500 to-amber-400",
                    "from-yellow-500 to-yellow-400",
                    "from-emerald-500 to-emerald-400",
                  ];
                  return (
                    <div key={step.label}>
                      <div className="flex items-center gap-3">
                        <span className="w-28 text-xs text-gray-600 text-right shrink-0">
                          {step.label}
                        </span>
                        <div className="flex-1 relative">
                          <div
                            className={`h-10 rounded-lg bg-gradient-to-r ${colors[i] || colors[0]} flex items-center px-3 transition-all`}
                            style={{ width: `${widthPct}%`, minWidth: "60px" }}
                          >
                            <span className="text-xs font-bold text-white whitespace-nowrap">
                              {n(step.count)}명
                            </span>
                          </div>
                        </div>
                        <div className="w-20 text-right shrink-0">
                          {i === 0 ? (
                            <span className="text-xs text-gray-400">시작</span>
                          ) : (
                            <div className="text-xs">
                              <span className="font-bold text-orange-600">
                                {step.stepRate}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {i > 0 && step.dropoff > 0 && (
                        <div className="ml-[7.75rem] mt-0.5 text-[10px] text-gray-400">
                          ▼ {n(step.dropoff)}명 이탈
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  전체 전환율 (조회 → 구매)
                </span>
                <span className="text-sm font-bold text-orange-600">
                  {funnel.steps[funnel.steps.length - 1].overallRate}%
                </span>
              </div>
            </div>
          )}
          {funnelLoading && !funnel && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                구매 퍼널
              </h3>
              <div className="text-center py-6 text-gray-400 text-sm">
                <div className="animate-spin inline-block w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full mb-2" />
                <p>퍼널 데이터 조회 중...</p>
              </div>
            </div>
          )}

          {/* Engagement Summary */}
          {data.summary.avgViewsPerUser > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">인당 평균 뷰수</div>
                <div className="text-xl font-bold text-gray-800">
                  {data.summary.avgViewsPerUser}
                  <span className="text-sm font-normal text-gray-400 ml-0.5">
                    회
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  총 {n(data.summary.totalViews)}회 / {n(data.summary.viewers)}명
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">조회자 수 (유니크)</div>
                <div className="text-xl font-bold text-gray-800">
                  {n(data.summary.viewers)}
                  <span className="text-sm font-normal text-gray-400 ml-0.5">
                    명
                  </span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">전환율 (조회→구매)</div>
                <div className="text-xl font-bold text-orange-600">
                  {data.summary.cvr}%
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  구매자 {n(data.summary.buyers)}명
                </div>
              </div>
            </div>
          )}

          {/* Daily Trend Chart */}
          {data.daily.length >= 2 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                일별 전환 추이
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.daily.map((d) => ({
                    ...d,
                    date: formatDate(d.date),
                  }))}
                  margin={{ top: 5, right: 50, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    formatter={(v, name) => {
                      const val = Number(v);
                      if (name === "CVR" || name === "인당뷰수")
                        return [name === "CVR" ? `${val}%` : `${val}회`, name];
                      return [n(val), name];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="viewers"
                    name="조회자"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="buyers"
                    name="구매자"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cvr"
                    name="CVR"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgViews"
                    name="인당뷰수"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 3 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Promotion Funnel */}
          {promoFunnel && promoFunnel.promotions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h3 className="text-sm font-bold text-gray-700">
                  기획전별 퍼널
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPromoSort("entry")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      promoSort === "entry"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    유입순
                  </button>
                  <button
                    onClick={() => setPromoSort("cvr")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      promoSort === "cvr"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    CVR순
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400">
                      <th className="text-left py-2 pr-2 font-medium w-6">#</th>
                      <th className="text-left py-2 pr-3 font-medium min-w-[160px]">
                        기획전
                      </th>
                      {promoFunnel.stepLabels.map((label) => (
                        <th
                          key={label}
                          className="text-right py-2 px-1.5 font-medium whitespace-nowrap"
                        >
                          {label}
                        </th>
                      ))}
                      <th className="text-right py-2 pl-2 font-medium">CVR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...promoFunnel.promotions]
                      .sort((a, b) =>
                        promoSort === "cvr"
                          ? b.cvr - a.cvr
                          : b.entry - a.entry
                      )
                      .map((promo, idx) => {
                        const maxEntry = promoFunnel.promotions[0].entry;
                        return (
                          <tr key={promo.name} className="hover:bg-gray-50">
                            <td className="py-2.5 pr-2 text-gray-300 font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 pr-3">
                              <div className="max-w-[220px] truncate text-gray-800 font-medium">
                                {promo.name}
                              </div>
                            </td>
                            {promo.steps.map((step) => (
                              <td
                                key={step.label}
                                className="py-2.5 px-1.5 text-right"
                              >
                                <div className="text-gray-700 tabular-nums">
                                  {n(step.count)}
                                </div>
                                <div className="mt-0.5">
                                  <div
                                    className="h-1 rounded-full bg-orange-300 ml-auto"
                                    style={{
                                      width: `${maxEntry > 0 ? Math.max(4, (step.count / maxEntry) * 100) : 0}%`,
                                    }}
                                  />
                                </div>
                              </td>
                            ))}
                            <td className="py-2.5 pl-2 text-right">
                              <span
                                className={`font-bold tabular-nums ${
                                  promo.cvr >= 10
                                    ? "text-emerald-600"
                                    : promo.cvr >= 5
                                      ? "text-orange-600"
                                      : "text-gray-500"
                                }`}
                              >
                                {promo.cvr}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                기획전 조회 → 상세페이지 → 장바구니 → 구매완료 · 전환 윈도우
                24시간
              </div>
            </div>
          )}

          {/* Main Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            {/* View toggle + Sort */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeTab("brand")}
                  className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    viewTab === "brand"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  브랜드별
                </button>
                <button
                  onClick={() => changeTab("product")}
                  className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    viewTab === "product"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  상품별
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => changeSort(opt.key)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      sortKey === opt.key
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Part filter */}
            <div className="flex gap-1.5 mb-4">
              {PART_FILTERS.map((pf) => (
                <button
                  key={pf}
                  onClick={() => changePart(pf)}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    partFilter === pf
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {pf}
                </button>
              ))}
            </div>

            {/* Table header */}
            <div className="flex items-center gap-3 px-1 pb-2 border-b border-gray-200 text-xs text-gray-400">
              <span className="w-6 text-right shrink-0">#</span>
              <span className="flex-1">
                {viewTab === "brand" ? "브랜드" : "상품"}
              </span>
              {viewTab === "product" && (
                <span className="w-20 text-right shrink-0 hidden sm:block">
                  브랜드
                </span>
              )}
              <span className="w-16 text-right shrink-0">조회자</span>
              <span className="w-16 text-right shrink-0">구매자</span>
              <span className="w-14 text-right shrink-0">CVR</span>
            </div>

            {/* Ranking items */}
            {pageItems.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                해당 구분의 데이터가 없습니다
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pageItems.map((item, i) => {
                  const rank = currentPage * PAGE_SIZE + i + 1;
                  const isProduct = "brand_nm" in item;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 py-3"
                    >
                      <span className="text-sm font-bold text-gray-300 w-6 text-right shrink-0">
                        {rank}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {item.name}
                          </span>
                          {partFilter === "전체" && (
                            <span
                              className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                                PART_BADGE[item.part] || PART_BADGE.미분류
                              }`}
                            >
                              {item.part}
                            </span>
                          )}
                        </div>
                      </div>

                      {isProduct && viewTab === "product" && (
                        <span className="w-20 text-right text-xs text-gray-400 truncate shrink-0 hidden sm:block">
                          {(item as ProductItem).brand_nm}
                        </span>
                      )}

                      <div
                        className={`w-16 text-right text-sm tabular-nums shrink-0 ${
                          sortKey === "views"
                            ? "font-bold text-orange-600"
                            : "text-gray-500"
                        }`}
                      >
                        {n(item.views)}
                      </div>

                      <div
                        className={`w-16 text-right text-sm tabular-nums shrink-0 ${
                          sortKey === "purchases"
                            ? "font-bold text-orange-600"
                            : "text-gray-500"
                        }`}
                      >
                        {n(item.purchases)}
                      </div>

                      <div
                        className={`w-14 text-right text-sm tabular-nums shrink-0 ${
                          sortKey === "cvr"
                            ? "font-bold text-orange-600"
                            : "text-gray-500"
                        }`}
                      >
                        {item.cvr}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="w-7 h-7 flex items-center justify-center text-sm text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-default"
                >
                  &lsaquo;
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-7 h-7 text-xs rounded-full font-medium transition-colors ${
                      currentPage === i
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPage === totalPages - 1}
                  className="w-7 h-7 flex items-center justify-center text-sm text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-default"
                >
                  &rsaquo;
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
