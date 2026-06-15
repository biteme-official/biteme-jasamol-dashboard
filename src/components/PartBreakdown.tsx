interface PartData {
  sales: number;
  orders: number;
  buyers: number;
  aov: number;
}

interface Props {
  parts: Record<string, PartData>;
  compareParts?: Record<string, PartData> | null;
}

const PART_COLORS: Record<string, string> = {
  PB: "border-orange-400",
  사입: "border-blue-400",
  위탁: "border-emerald-400",
  미분류: "border-gray-400",
};

const PART_BG: Record<string, string> = {
  PB: "bg-orange-50",
  사입: "bg-blue-50",
  위탁: "bg-emerald-50",
  미분류: "bg-gray-50",
};

function n(v: number): string {
  return v.toLocaleString("ko-KR");
}

function diffPct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return null;
  const pos = diff > 0;
  const neg = diff < 0;
  return (
    <span
      className={`text-xs font-medium ${
        pos ? "text-red-500" : neg ? "text-blue-500" : "text-gray-400"
      }`}
    >
      {pos ? "▲" : neg ? "▼" : ""}
      {Math.abs(diff).toFixed(1)}%
    </span>
  );
}

export default function PartBreakdown({ parts, compareParts }: Props) {
  const partKeys = Object.keys(parts);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {partKeys.map((key) => {
        const p = parts[key];
        const cp = compareParts?.[key];
        return (
          <div
            key={key}
            className={`border-l-4 ${PART_COLORS[key] || "border-gray-400"} ${PART_BG[key] || "bg-gray-50"} rounded-xl p-3 sm:p-5`}
          >
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="text-sm font-bold text-gray-800">{key}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <div className="text-[10px] sm:text-xs text-gray-500">매출</div>
                <div className="text-sm sm:text-lg font-bold truncate">{n(p.sales)}원</div>
                {cp && <DiffBadge diff={diffPct(p.sales, cp.sales)} />}
              </div>
              <div>
                <div className="text-[10px] sm:text-xs text-gray-500">주문</div>
                <div className="text-sm sm:text-lg font-bold">{n(p.orders)}건</div>
                {cp && <DiffBadge diff={diffPct(p.orders, cp.orders)} />}
              </div>
              <div>
                <div className="text-[10px] sm:text-xs text-gray-500">AOV</div>
                <div className="text-sm sm:text-lg font-bold truncate">{n(p.aov)}원</div>
                {cp && <DiffBadge diff={diffPct(p.aov, cp.aov)} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
