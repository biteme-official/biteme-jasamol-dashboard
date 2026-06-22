"use client";

import { useState, useEffect } from "react";
import { format, subDays, subWeeks, subMonths, subYears, differenceInDays } from "date-fns";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

type ComparePreset = "auto" | "custom" | "off";

interface Props {
  mainStart: string;
  mainEnd: string;
  periodLabel: string;
  onChange: (compareStart: string | null, compareEnd: string | null, label: string) => void;
}

export default function CompareSelector({ mainStart, mainEnd, periodLabel, onChange }: Props) {
  const [mode, setMode] = useState<ComparePreset>("auto");
  const [autoType, setAutoType] = useState("전기간");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function calcAuto(type: string): [string, string, string] {
    const s = new Date(mainStart);
    const e = new Date(mainEnd);
    const days = differenceInDays(e, s);

    switch (type) {
      case "전기간": {
        if (periodLabel.includes("달")) {
          const cs = subMonths(s, 1);
          const ce = subMonths(e, 1);
          return [fmt(cs), fmt(ce), `전기간 (${fmt(cs)} ~ ${fmt(ce)})`];
        } else if (periodLabel.includes("주")) {
          const cs = subWeeks(s, 1);
          const ce = subWeeks(e, 1);
          return [fmt(cs), fmt(ce), `전기간 (${fmt(cs)} ~ ${fmt(ce)})`];
        } else {
          const ce = subDays(s, 1);
          const cs = subDays(s, days + 1);
          return [fmt(cs), fmt(ce), `전기간 (${fmt(cs)} ~ ${fmt(ce)})`];
        }
      }
      case "전주": {
        const cs = subWeeks(s, 1);
        const ce = subWeeks(e, 1);
        return [fmt(cs), fmt(ce), `전주 (${fmt(cs)} ~ ${fmt(ce)})`];
      }
      case "전월": {
        const cs = subMonths(s, 1);
        const ce = subMonths(e, 1);
        return [fmt(cs), fmt(ce), `전월 (${fmt(cs)} ~ ${fmt(ce)})`];
      }
      case "전년동기": {
        const cs = subYears(s, 1);
        const ce = subYears(e, 1);
        return [fmt(cs), fmt(ce), `전년동기 (${fmt(cs)} ~ ${fmt(ce)})`];
      }
      default:
        return [fmt(subDays(s, days + 1)), fmt(subDays(s, 1)), "전기간"];
    }
  }

  useEffect(() => {
    if (mode === "auto") {
      const [cs, ce, lbl] = calcAuto(autoType);
      onChange(cs, ce, lbl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainStart, mainEnd, periodLabel]);

  function handleAutoChange(type: string) {
    setAutoType(type);
    const [cs, ce, lbl] = calcAuto(type);
    onChange(cs, ce, lbl);
  }

  function handleModeChange(m: ComparePreset) {
    setMode(m);
    if (m === "off") {
      onChange(null, null, "비교 없음");
    } else if (m === "auto") {
      const [cs, ce, lbl] = calcAuto(autoType);
      onChange(cs, ce, lbl);
    }
  }

  function handleCustomApply() {
    if (customStart && customEnd) {
      onChange(customStart, customEnd, `직접 설정 (${customStart} ~ ${customEnd})`);
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <span className="text-xs sm:text-sm text-gray-500">비교:</span>

      {/* Mode toggle */}
      <div className="flex items-center gap-1">
        {(["auto", "custom", "off"] as ComparePreset[]).map((m) => {
          const labels = { auto: "프리셋", custom: "직접", off: "끄기" };
          return (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>

      {/* Auto presets */}
      {mode === "auto" && (
        <div className="flex items-center gap-1 sm:gap-1.5">
          {["전기간", "전주", "전월", "전년동기"].map((type) => (
            <button
              key={type}
              onClick={() => handleAutoChange(type)}
              className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                autoType === type
                  ? "bg-orange-500 text-white"
                  : "bg-orange-50 text-orange-600 hover:bg-orange-100"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Custom date pickers */}
      {mode === "custom" && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="border rounded-md px-1.5 sm:px-2 py-1 text-xs w-[120px] sm:w-auto"
          />
          <span className="text-gray-400 text-xs">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="border rounded-md px-1.5 sm:px-2 py-1 text-xs w-[120px] sm:w-auto"
          />
          <button
            onClick={handleCustomApply}
            className="px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 shrink-0"
          >
            적용
          </button>
        </div>
      )}
    </div>
  );
}
