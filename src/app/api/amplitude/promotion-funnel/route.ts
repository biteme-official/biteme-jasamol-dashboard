import { NextRequest } from "next/server";
import { queryFunnel } from "@/lib/amplitude";

function toAmpDate(d: string) {
  return d.replace(/-/g, "");
}

const STEPS = [
  { event_type: "view_eventpage", label: "기획전 조회" },
  { event_type: "view_detailpage", label: "상세페이지" },
  { event_type: "click_detail_addtocart", label: "장바구니" },
  { event_type: "complete_total_order", label: "구매 완료" },
];

interface FunnelSegment {
  cumulativeRaw: number[];
  cumulative: number[];
  stepByStep: number[];
  events: string[];
  groupValue: string;
  meta: { segmentIndex: number; byProp?: string };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return Response.json({ error: "start and end required" }, { status: 400 });
  }

  if (!process.env.AMPLITUDE_API_KEY || !process.env.AMPLITUDE_SECRET_KEY) {
    return Response.json(
      { error: "AMPLITUDE_API_KEY / AMPLITUDE_SECRET_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const events = STEPS.map((s, i) =>
      i === 0
        ? {
            event_type: s.event_type,
            group_by: [{ type: "event", value: "event_name" }],
          }
        : { event_type: s.event_type }
    );

    const result = await queryFunnel({
      events,
      start: toAmpDate(start),
      end: toAmpDate(end),
      mode: "ordered",
      conversionSeconds: 86400,
    });

    const data = result.data as Record<string, FunnelSegment>;

    const promotions = Object.values(data)
      .filter((seg) => {
        const name = seg.meta?.byProp || seg.groupValue;
        return name && name !== "" && name !== "(none)";
      })
      .map((seg) => {
        const name = seg.meta?.byProp || seg.groupValue || "unknown";
        const counts = seg.cumulativeRaw;
        const entry = counts[0] || 0;
        const final = counts[counts.length - 1] || 0;
        return {
          name,
          steps: STEPS.map((s, i) => ({
            label: s.label,
            count: counts[i] || 0,
            rate:
              entry > 0
                ? Math.round(((counts[i] || 0) / entry) * 10000) / 100
                : 0,
          })),
          entry,
          final,
          cvr: entry > 0 ? Math.round((final / entry) * 10000) / 100 : 0,
        };
      })
      .sort((a, b) => b.entry - a.entry)
      .slice(0, 15);

    return Response.json({
      stepLabels: STEPS.map((s) => s.label),
      promotions,
    });
  } catch (e) {
    console.error("Promotion funnel API error:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
