interface Props {
  label: string;
  value: string;
  sub?: string;
  diff?: number | null;
  prevValue?: string;
}

export default function KPICard({ label, value, sub, diff, prevValue }: Props) {
  const hasDiff = diff !== null && diff !== undefined && !isNaN(diff);
  const isPositive = hasDiff && diff > 0;
  const isNegative = hasDiff && diff < 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 flex flex-col gap-0.5 sm:gap-1">
      <span className="text-xs sm:text-sm text-gray-500">{label}</span>
      <span className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{value}</span>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
        {hasDiff && (
          <span
            className={`text-xs font-medium ${
              isPositive ? "text-red-500" : isNegative ? "text-blue-500" : "text-gray-400"
            }`}
          >
            {isPositive ? "▲" : isNegative ? "▼" : ""}
            {Math.abs(diff).toFixed(1)}%
          </span>
        )}
        {prevValue && (
          <span className="text-xs text-gray-300">{prevValue}</span>
        )}
      </div>
    </div>
  );
}
