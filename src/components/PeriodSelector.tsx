"use client";

import { useState } from "react";
import { format, subDays, startOfWeek, startOfMonth, subWeeks, subMonths } from "date-fns";

interface Props {
  onSelect: (start: string, end: string, label: string) => void;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

const presets = [
  { label: "오늘", range: () => { const t = new Date(); return [t, t]; } },
  { label: "어제", range: () => { const y = subDays(new Date(), 1); return [y, y]; } },
  { label: "이번주", range: () => { const t = new Date(); return [startOfWeek(t, { weekStartsOn: 1 }), t]; } },
  { label: "지난주", range: () => { const t = new Date(); const ls = startOfWeek(subWeeks(t, 1), { weekStartsOn: 1 }); return [ls, subDays(startOfWeek(t, { weekStartsOn: 1 }), 1)]; } },
  { label: "이번달", range: () => { const t = new Date(); return [startOfMonth(t), t]; } },
  { label: "지난달", range: () => { const t = new Date(); const ls = startOfMonth(subMonths(t, 1)); return [ls, subDays(startOfMonth(t), 1)]; } },
  { label: "7일", range: () => { const t = new Date(); return [subDays(t, 6), t]; } },
  { label: "28일", range: () => { const t = new Date(); return [subDays(t, 27), t]; } },
] as const;

export default function PeriodSelector({ onSelect }: Props) {
  const [active, setActive] = useState("오늘");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  function handlePreset(label: string, rangeFn: () => [Date, Date]) {
    const [s, e] = rangeFn();
    setActive(label);
    setShowCustom(false);
    onSelect(fmt(s), fmt(e), label);
  }

  function handleCustom() {
    if (customStart && customEnd) {
      setActive("");
      onSelect(customStart, customEnd, `${customStart} ~ ${customEnd}`);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => handlePreset(p.label, p.range as () => [Date, Date])}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            active === p.label
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {p.label}
        </button>
      ))}

      <button
        onClick={() => setShowCustom(!showCustom)}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          showCustom ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        기간 설정
      </button>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          />
          <button
            onClick={handleCustom}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-orange-500 text-white hover:bg-orange-600"
          >
            조회
          </button>
        </div>
      )}
    </div>
  );
}
