import { NextRequest } from "next/server";
import { queryFunnel } from "@/lib/amplitude";

function toAmpDate(d: string) {
  return d.replace(/-/g, "");
}

const STEPS = [
  { event_type: "view_detailpage", label: "상세페이지 조회" },
  { event_type: "click_detail_startpurchase", label: "구매하기 클릭" },
  { event_type: "ce:구매시작", label: "구매 시작" },
  { event_type: "complete_total_order", label: "구매 완료" },
];

interface FunnelSegment {
  cumulativeRaw: number[];
  cumulative: number[];
  stepByStep: number[];
  events: string[];
  dayFunnels?: {
    xValues: string[];
    series: number[][];
  };
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
    const result = await queryFunnel({
      events: STEPS.map((s) => ({ event_type: s.event_type })),
      start: toAmpDate(start),
      end: toAmpDate(end),
      mode: "ordered",
      conversionSeconds: 86400,
    });

    const segment = (result.data["0"] ||
      Object.values(result.data)[0]) as FunnelSegment;

    const stepCounts = segment.cumulativeRaw;

    const steps = STEPS.map((s, i) => ({
      label: s.label,
      count: stepCounts[i] || 0,
      overallRate: Math.round((segment.cumulative[i] || 0) * 10000) / 100,
      stepRate:
        i === 0
          ? 100
          : Math.round((segment.stepByStep[i] || 0) * 10000) / 100,
      dropoff: i === 0 ? 0 : (stepCounts[i - 1] || 0) - (stepCounts[i] || 0),
    }));

    const daily = segment.dayFunnels
      ? segment.dayFunnels.xValues.map((date, di) => {
          const daySeries = segment.dayFunnels!.series[di] || [];
          return {
            date,
            viewers: daySeries[0] || 0,
            buyers: daySeries[daySeries.length - 1] || 0,
            cvr:
              daySeries[0] > 0
                ? Math.round(
                    (daySeries[daySeries.length - 1] / daySeries[0]) * 10000
                  ) / 100
                : 0,
          };
        })
      : [];

    return Response.json({ steps, daily });
  } catch (e) {
    console.error("Funnel API error:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
