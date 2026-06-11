import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { productRankingSQL } from "@/lib/queries";

interface ProductRow {
  product_cd: string;
  product_nm: string;
  part: string;
  order_count: number;
  total_qty: number;
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

    const rows = await query<ProductRow>(productRankingSQL(start, end));

    const products = rows.map((r) => ({
      product_cd: r.product_cd,
      product_nm: r.product_nm,
      part: r.part,
      order_count: Number(r.order_count),
      total_qty: Number(r.total_qty),
      total_sales: Number(r.total_sales),
    }));

    return NextResponse.json({ products });
  } catch (e) {
    console.error("Product ranking API error:", e);
    return NextResponse.json(
      { error: "DB 조회 실패", detail: String(e) },
      { status: 500 }
    );
  }
}
