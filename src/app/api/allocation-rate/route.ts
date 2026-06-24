import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { allocationRateSummarySQL } from "@/lib/queries";

interface AllocationRateRow {
  total_fee: number;
  witrak_net_sales: number;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toResult(rows: AllocationRateRow[]) {
  const fee = Number(rows[0]?.total_fee ?? 0);
  const netSales = Number(rows[0]?.witrak_net_sales ?? 0);
  const rate = netSales > 0 ? Math.round((fee / netSales) * 10000) / 100 : 0;
  return { fee, netSales, rate };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const startStr = params.get("start");
  const endStr = params.get("end");
  const compareStartStr = params.get("compareStart");
  const compareEndStr = params.get("compareEnd");

  if (!startStr || !endStr) {
    return NextResponse.json({ error: "start, end required" }, { status: 400 });
  }

  try {
    const start = startOfDay(parseDate(startStr));
    const end = endOfDay(parseDate(endStr));

    const rows = await query<AllocationRateRow>(allocationRateSummarySQL(start, end));
    const current = toResult(rows);

    let compare = null;
    if (compareStartStr && compareEndStr) {
      const cStart = startOfDay(parseDate(compareStartStr));
      const cEnd = endOfDay(parseDate(compareEndStr));
      const cRows = await query<AllocationRateRow>(allocationRateSummarySQL(cStart, cEnd));
      compare = toResult(cRows);
    }

    return NextResponse.json({ current, compare });
  } catch (e) {
    console.error("Allocation rate API error:", e);
    return NextResponse.json({ error: "DB 조회 실패", detail: String(e) }, { status: 500 });
  }
}
