const API_KEY = process.env.AMPLITUDE_API_KEY || "";
const SECRET_KEY = process.env.AMPLITUDE_SECRET_KEY || "";
const BASE = process.env.AMPLITUDE_API_URL || "https://amplitude.com/api/2";

interface SegmentationQuery {
  eventType: string;
  metric: "uniques" | "totals";
  start: string;
  end: string;
  interval?: number;
  groupBy?: { type: "event" | "user"; value: string };
  limit?: number;
}

interface AmplitudeSeriesLabel {
  setId: string;
  value: string | number;
}

interface AmplitudeResponse {
  data: {
    series: number[][];
    seriesLabels: AmplitudeSeriesLabel[][];
    seriesCollapsed: Array<Array<{ setId: string; value: number }>>;
    xValues: string[];
  };
}

export async function querySegmentation(q: SegmentationQuery): Promise<AmplitudeResponse> {
  const e: Record<string, unknown> = { event_type: q.eventType };
  if (q.groupBy) e.group_by = [q.groupBy];

  const params = new URLSearchParams({
    e: JSON.stringify(e),
    m: q.metric,
    start: q.start,
    end: q.end,
    i: String(q.interval ?? 1),
  });
  if (q.limit) params.set("limit", String(q.limit));

  const auth = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString("base64");
  const res = await fetch(`${BASE}/events/segmentation?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplitude ${res.status}: ${text}`);
  }
  return res.json();
}

export function parseTrend(res: AmplitudeResponse): { total: number; daily: { date: string; value: number }[] } {
  const series = res.data.series[0] || [];
  const xValues = res.data.xValues || [];
  const daily = xValues.map((date, i) => ({ date, value: series[i] || 0 }));
  const total = series.reduce((sum, v) => sum + v, 0);
  return { total, daily };
}

interface FunnelEvent {
  event_type: string;
  group_by?: { type: string; value: string }[];
}

interface FunnelQuery {
  events: FunnelEvent[];
  start: string;
  end: string;
  mode?: "ordered" | "unordered";
  conversionSeconds?: number;
}

export async function queryFunnel(q: FunnelQuery) {
  const auth = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString("base64");

  const parts = q.events.map((ev) => {
    const obj: Record<string, unknown> = { event_type: ev.event_type };
    if (ev.group_by) obj.group_by = ev.group_by;
    return `e=${encodeURIComponent(JSON.stringify(obj))}`;
  });
  parts.push(`start=${q.start}`);
  parts.push(`end=${q.end}`);
  parts.push(`mode=${q.mode || "ordered"}`);
  parts.push("n=active");
  if (q.conversionSeconds) parts.push(`cs=${q.conversionSeconds}`);

  const res = await fetch(`${BASE}/funnels?${parts.join("&")}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplitude funnel ${res.status}: ${text}`);
  }
  return res.json();
}

export function parseGroupBy(res: AmplitudeResponse): { name: string; users: number }[] {
  const labels = res.data.seriesLabels || [];
  const collapsed = res.data.seriesCollapsed || [];

  return labels.map((label, i) => {
    // V2 API returns labels as [segmentIndex, "groupValue"]
    const raw = label as unknown;
    let name: string;
    if (Array.isArray(raw) && raw.length >= 2 && typeof raw[1] === "string") {
      name = raw[1] || "(none)";
    } else if (Array.isArray(raw) && raw[0] && typeof raw[0] === "object" && "value" in raw[0]) {
      name = String((raw[0] as { value: unknown }).value || "(none)");
    } else {
      name = "(none)";
    }

    const collapseArr = collapsed[i] || [];
    const users = collapseArr.length > 0
      ? collapseArr[0].value
      : (res.data.series[i] || []).reduce((s, v) => s + v, 0);
    return { name, users };
  }).sort((a, b) => b.users - a.users);
}
