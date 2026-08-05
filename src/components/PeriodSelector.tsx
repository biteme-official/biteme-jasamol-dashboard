"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  format,
  subDays,
  startOfWeek,
  startOfMonth,
  subWeeks,
  subMonths,
} from "date-fns";

interface Props {
  onSelect: (start: string, end: string, label: string) => void;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

const presets = [
  {
    label: "오늘",
    range: () => {
      const t = new Date();
      return [t, t] as [Date, Date];
    },
  },
  {
    label: "어제",
    range: () => {
      const y = subDays(new Date(), 1);
      return [y, y] as [Date, Date];
    },
  },
  {
    label: "이번주",
    range: () => {
      const t = new Date();
      return [startOfWeek(t, { weekStartsOn: 1 }), t] as [Date, Date];
    },
  },
  {
    label: "지난주",
    range: () => {
      const t = new Date();
      const ls = startOfWeek(subWeeks(t, 1), { weekStartsOn: 1 });
      return [ls, subDays(startOfWeek(t, { weekStartsOn: 1 }), 1)] as [
        Date,
        Date,
      ];
    },
  },
  {
    label: "이번달",
    range: () => {
      const t = new Date();
      return [startOfMonth(t), t] as [Date, Date];
    },
  },
  {
    label: "지난달",
    range: () => {
      const t = new Date();
      const ls = startOfMonth(subMonths(t, 1));
      return [ls, subDays(startOfMonth(t), 1)] as [Date, Date];
    },
  },
];

export default function PeriodSelector({ onSelect }: Props) {
  const [active, setActive] = useState("오늘");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;

    function updatePos() {
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPopupPos({ top: r.bottom + 8, left: Math.max(8, r.right - 280) });
      }
    }
    updatePos();

    function handleClick(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  function handlePreset(label: string, rangeFn: () => [Date, Date]) {
    const [s, e] = rangeFn();
    setActive(label);
    setOpen(false);
    onSelect(fmt(s), fmt(e), label);
  }

  function handleCustom() {
    if (customStart && customEnd) {
      setActive("");
      setOpen(false);
      onSelect(customStart, customEnd, `${customStart} ~ ${customEnd}`);
    }
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => handlePreset(p.label, p.range)}
          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            active === p.label
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {p.label}
        </button>
      ))}

      <div>
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            open || active === ""
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          기간 설정
        </button>

        {open && createPortal(
          <div
            ref={popupRef}
            style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 9999 }}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-[280px]"
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>
              <button
                onClick={handleCustom}
                disabled={!customStart || !customEnd}
                className="w-full py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                조회
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
