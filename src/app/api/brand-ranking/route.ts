import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { brandRankingSQL } from "@/lib/queries";

interface BrandRow {
  brand_cd: string;
  brand_nm: string;
  part: string;
  order_count: number;
  total_sales: number;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const startStr = params.get("start");
  const endStr = params.get("end");

  if (!startStr || !endStr) {
    return NextResponse.json({ error: "start, end required" }, { status: 400 });
  }

  try {
    const start = startOfDay(parseDate(startStr));
    const end = endOfDay(parseDate(endStr));

    const rows = await query<BrandRow>(brandRankingSQL(start, end));

    const brands = rows.map((r) => ({
      brand_cd: r.brand_cd,
      brand_nm: r.brand_nm,
      part: r.part,
      order_count: Number(r.order_count),
      total_sales: Number(r.total_sales),
    }));

    return NextResponse.json({ brands });
  } catch (e) {
    console.error("Brand ranking API error:", e);
    return NextResponse.json(
      { error: "DB 조회 실패", detail: String(e) },
      { status: 500 }
    );
  }
}
