const BASE = "https://api.airbridge.io/reports/api/v4/apps";

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRBRIDGE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

const APP = () => process.env.AIRBRIDGE_APP_NAME!;

async function requestReport(
  from: string,
  to: string,
  metrics: string[]
): Promise<string> {
  const res = await fetch(`${BASE}/${APP()}/active-users/query`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from,
      to,
      granularity: "day",
      metrics,
      groupBy: { fields: [] },
      filters: [],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airbridge request failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.task.taskId;
}

async function pollResult(taskId: string, maxRetries = 15): Promise<unknown> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${BASE}/${APP()}/active-users/query/${taskId}`, {
      headers: headers(),
    });

    if (!res.ok) continue;

    const json = await res.json();
    if (json.task.status === "SUCCESS") return json;
    if (json.task.status === "FAILED") throw new Error("Airbridge report failed");
  }
  throw new Error("Airbridge report timeout");
}

interface DauRow {
  date: string;
  app: number;
  web: number;
  total: number;
}

export async function fetchDAU(from: string, to: string): Promise<DauRow[]> {
  const [appTaskId, webTaskId] = await Promise.all([
    requestReport(from, to, ["app_au"]),
    requestReport(from, to, ["web_au"]),
  ]);

  const [appResult, webResult] = (await Promise.all([
    pollResult(appTaskId),
    pollResult(webTaskId),
  ])) as [Record<string, unknown>, Record<string, unknown>];

  const appData = extractRows(appResult, "app_au");
  const webData = extractRows(webResult, "web_au");

  const dateMap = new Map<string, { app: number; web: number }>();

  for (const { date, value } of appData) {
    if (!dateMap.has(date)) dateMap.set(date, { app: 0, web: 0 });
    dateMap.get(date)!.app = value;
  }
  for (const { date, value } of webData) {
    if (!dateMap.has(date)) dateMap.set(date, { app: 0, web: 0 });
    dateMap.get(date)!.web = value;
  }

  return Array.from(dateMap.entries())
    .map(([date, { app, web }]) => ({
      date,
      app,
      web,
      total: app + web,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function extractRows(
  result: Record<string, unknown>,
  metricKey: string
): { date: string; value: number }[] {
  try {
    const activeUsers = result.activeUsers as Record<string, unknown>;
    const data = activeUsers.data as Array<Record<string, unknown>>;
    const rows = data[0].rows as Array<Record<string, unknown>>;

    return rows.map((row) => {
      const dateStr = (row.date as string).slice(0, 10);
      const values = row.values as Record<string, number>;
      return { date: dateStr, value: values[metricKey] || 0 };
    });
  } catch {
    return [];
  }
}

export interface ChannelDauRow {
  channel: string;
  daily: { date: string; app: number; web: number }[];
  app: number;
  web: number;
  total: number;
}

export async function fetchChannelDAU(
  from: string,
  to: string
): Promise<ChannelDauRow[]> {
  const res = await fetch(`${BASE}/${APP()}/active-users/query`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from,
      to,
      granularity: "day",
      metrics: ["app_au", "web_au"],
      groupBy: { fields: ["channel"] },
      filters: [],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airbridge channel request failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const taskId: string = json.task.taskId;
  const result = (await pollResult(taskId)) as Record<string, unknown>;

  const activeUsers = result.activeUsers as Record<string, unknown>;
  const data = activeUsers.data as Array<Record<string, unknown>>;

  return data
    .map((item) => {
      const groupBys = item.groupBys as string[];
      const channel = groupBys[0] || "(none)";
      const rows = item.rows as Array<Record<string, unknown>>;

      let appTotal = 0;
      let webTotal = 0;
      const daily = rows.map((row) => {
        const dateStr = (row.date as string).slice(0, 10);
        const values = row.values as Record<string, number>;
        const app = values.app_au || 0;
        const web = values.web_au || 0;
        appTotal += app;
        webTotal += web;
        return { date: dateStr, app, web };
      });

      return { channel, daily, app: appTotal, web: webTotal, total: appTotal + webTotal };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
}
