"use client";

import { useState, useMemo } from "react";

interface Brand {
  brand_cd: string;
  brand_nm: string;
  part: string;
  order_count: number;
  total_sales: number;
}

type SortKey = "total_sales" | "order_count";
type PartFilter = "전체" | "PB" | "사입" | "위탁";

const PART_FILTERS: PartFilter[] = ["전체", "PB", "사입", "위탁"];
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "total_sales", label: "매출" },
  { key: "order_count", label: "주문건수" },
];

const PAGE_SIZE = 10;
const MAX_ITEMS = 30;

function n(v: number): string {
  return v.toLocaleString("ko-KR");
}

const PART_BADGE: Record<string, string> = {
  PB: "bg-orange-100 text-orange-700",
  사입: "bg-blue-100 text-blue-700",
  위탁: "bg-emerald-100 text-emerald-700",
  미분류: "bg-gray-100 text-gray-600",
};

interface Props {
  brands: Brand[];
}

export default function BrandRanking({ brands }: Props) {
  const [partFilter, setPartFilter] = useState<PartFilter>("전체");
  const [sortKey, setSortKey] = useState<SortKey>("total_sales");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const items =
      partFilter === "전체"
        ? brands
        : brands.filter((b) => b.part === partFilter);
    return [...items].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, MAX_ITEMS);
  }, [brands, partFilter, sortKey]);

  const totalPages = Math.min(3, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const pageItems = filtered.slice(
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
        <h3 className="text-sm font-bold text-gray-700">브랜드별 매출 순위</h3>
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

      {pageItems.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          해당 구분의 브랜드가 없습니다
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {pageItems.map((item, i) => {
            const rank = currentPage * PAGE_SIZE + i + 1;
            return (
              <div
                key={item.brand_cd}
                className="flex items-center gap-3 py-3"
              >
                <span className="text-sm font-bold text-gray-300 w-6 text-right shrink-0">
                  {rank}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {item.brand_nm}
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

                <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-right">
                  <div className="w-[72px] sm:w-24">
                    <div
                      className={`text-xs sm:text-sm tabular-nums ${
                        sortKey === "total_sales"
                          ? "font-bold text-orange-600"
                          : "text-gray-500"
                      }`}
                    >
                      {n(item.total_sales)}원
                    </div>
                  </div>
                  <div className="w-10 sm:w-14">
                    <div
                      className={`text-[10px] sm:text-xs tabular-nums ${
                        sortKey === "order_count"
                          ? "font-bold text-orange-600"
                          : "text-gray-400"
                      }`}
                    >
                      {n(item.order_count)}건
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="w-7 h-7 flex items-center justify-center text-sm text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-default"
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
