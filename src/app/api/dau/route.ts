import { NextRequest, NextResponse } from "next/server";
import { fetchDAU } from "@/lib/airbridge";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = params.get("start");
  const end = params.get("end");
  const compareStart = params.get("compareStart");
  const compareEnd = params.get("compareEnd");

  if (!start || !end) {
    return NextResponse.json({ error: "start, end required" }, { status: 400 });
  }

  try {
    const current = await fetchDAU(start, end);

    let compare = null;
    if (compareStart && compareEnd) {
      compare = await fetchDAU(compareStart, compareEnd);
    }

    const sum = (rows: typeof current) =>
      rows.reduce((acc, r) => acc + r.total, 0);
    const avg = (rows: typeof current) =>
      rows.length ? Math.round(sum(rows) / rows.length) : 0;

    const sumApp = (rows: typeof current) => rows.reduce((a, r) => a + r.app, 0);
    const sumWeb = (rows: typeof current) => rows.reduce((a, r) => a + r.web, 0);

    return NextResponse.json({
      current: {
        daily: current,
        totalDAU: sum(current),
        totalApp: sumApp(current),
        totalWeb: sumWeb(current),
        avgDAU: avg(current),
      },
      compare: compare
        ? {
            daily: compare,
            totalDAU: sum(compare),
            avgDAU: avg(compare),
          }
        : null,
    });
  } catch (e) {
    console.error("DAU API error:", e);
    return NextResponse.json(
      { error: "Airbridge 조회 실패", detail: String(e) },
      { status: 500 }
    );
  }
}
