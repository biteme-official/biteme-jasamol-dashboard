import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { salesSQL, addonOptSalesSQL } from "@/lib/queries";

interface SalesRow {
  sale_date: string;
  sale_hour: number;
  ocode: string;
  product_ocode: string;
  userid: string;
  part: string;
  net_sales: number;
}

interface AddonRow {
  DAY: string;
  part: string;
  ocode: string;
  product_ocode: string;
  opt_amount: number;
}

interface PartData {
  sales: number;
  orders: number;
  buyers: number;
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

function filterByHour(rows: SalesRow[], addonRows: AddonRow[], maxHour: number): { rows: SalesRow[]; addon: AddonRow[] } {
  return {
    rows: rows.filter((r) => Number(r.sale_hour) <= maxHour),
    addon: addonRows.filter((a) => {
      const h = typeof a.DAY === "string" ? Number(a.DAY.slice(11, 13)) : new Date(a.DAY).getHours();
      return h <= maxHour;
    }),
  };
}

function aggregate(rows: SalesRow[], addonRows: AddonRow[], singleDay: boolean) {
  const parts: Record<string, PartData> = {};
  const orderSet = new Set<string>();
  const memberSet = new Set<string>();
  const nonmemberOrders = new Set<string>();
  let totalSales = 0;

  const dailyMap: Record<string, { sales: number; orders: Set<string> }> = {};
  const hourlyMap: Record<number, { sales: number; orders: Set<string> }> = {};

  const addonByPart: Record<string, number> = {};
  const addonByDate: Record<string, number> = {};
  const addonByHour: Record<number, number> = {};
  let totalAddon = 0;
  for (const a of addonRows) {
    const amt = Number(a.opt_amount);
    totalAddon += amt;
    const p = a.part || "미분류";
    addonByPart[p] = (addonByPart[p] || 0) + amt;
    const dateKey = typeof a.DAY === "string"
      ? a.DAY.slice(0, 10)
      : new Date(a.DAY).toISOString().slice(0, 10);
    addonByDate[dateKey] = (addonByDate[dateKey] || 0) + amt;
    if (singleDay) {
      const h = typeof a.DAY === "string" ? Number(a.DAY.slice(11, 13)) : new Date(a.DAY).getHours();
      addonByHour[h] = (addonByHour[h] || 0) + amt;
    }
  }

  for (const row of rows) {
    const ns = Number(row.net_sales);
    totalSales += ns;
    orderSet.add(row.ocode);

    if (row.userid === "비회원") {
      nonmemberOrders.add(row.ocode);
    } else {
      memberSet.add(row.userid);
    }

    const p = row.part || "미분류";
    if (!parts[p]) parts[p] = { sales: 0, orders: 0, buyers: 0 };
    parts[p].sales += ns;

    const dateKey = typeof row.sale_date === "string"
      ? row.sale_date.slice(0, 10)
      : new Date(row.sale_date).toISOString().slice(0, 10);

    if (!dailyMap[dateKey]) dailyMap[dateKey] = { sales: 0, orders: new Set() };
    dailyMap[dateKey].sales += ns;
    dailyMap[dateKey].orders.add(row.ocode);

    if (singleDay) {
      const h = Number(row.sale_hour);
      if (!hourlyMap[h]) hourlyMap[h] = { sales: 0, orders: new Set() };
      hourlyMap[h].sales += ns;
      hourlyMap[h].orders.add(row.ocode);
    }
  }

  const partOrders: Record<string, Set<string>> = {};
  const partMembers: Record<string, Set<string>> = {};
  const partNonmembers: Record<string, Set<string>> = {};
  for (const row of rows) {
    const p = row.part || "미분류";
    if (!partOrders[p]) partOrders[p] = new Set();
    if (!partMembers[p]) partMembers[p] = new Set();
    if (!partNonmembers[p]) partNonmembers[p] = new Set();
    partOrders[p].add(row.ocode);
    if (row.userid === "비회원") partNonmembers[p].add(row.ocode);
    else partMembers[p].add(row.userid);
  }

  for (const p of Object.keys(parts)) {
    parts[p].orders = partOrders[p]?.size || 0;
    parts[p].buyers = (partMembers[p]?.size || 0) + (partNonmembers[p]?.size || 0);
  }

  const totalOrders = orderSet.size;
  const totalBuyers = memberSet.size + nonmemberOrders.size;

  const daily = Object.entries(dailyMap)
    .map(([date, d]) => ({ date, sales: Math.round(d.sales + (addonByDate[date] || 0)), orders: d.orders.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourly = singleDay
    ? Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        sales: Math.round((hourlyMap[h]?.sales || 0) + (addonByHour[h] || 0)),
        orders: hourlyMap[h]?.orders.size || 0,
      }))
    : null;

  return {
    totalSales: Math.round(totalSales + totalAddon),
    totalOrders,
    totalBuyers,
    aov: totalOrders ? Math.round(totalSales / totalOrders) : 0,
    parts: Object.fromEntries(
      ["PB", "사입", "위탁", "미분류"]
        .filter((p) => parts[p])
        .map((p) => {
          const s = Math.round(parts[p].sales + (addonByPart[p] || 0));
          return [
            p,
            {
              sales: s,
              orders: parts[p].orders,
              buyers: parts[p].buyers,
              aov: parts[p].orders ? Math.round(s / parts[p].orders) : 0,
            },
          ];
        })
    ),
    daily,
    hourly,
  };
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
    const singleDay = startStr === endStr;

    const [rows, addonRows] = await Promise.all([
      query<SalesRow>(salesSQL(start, end)),
      query<AddonRow>(addonOptSalesSQL(start, end)),
    ]);
    const current = aggregate(rows, addonRows, singleDay);

    let compare = null;
    if (compareStartStr && compareEndStr) {
      const cStart = startOfDay(parseDate(compareStartStr));
      const cEnd = endOfDay(parseDate(compareEndStr));
      const cSingleDay = compareStartStr === compareEndStr;
      const [cRows, cAddon] = await Promise.all([
        query<SalesRow>(salesSQL(cStart, cEnd)),
        query<AddonRow>(addonOptSalesSQL(cStart, cEnd)),
      ]);

      const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST
      const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      const isMainToday = singleDay && startStr === todayStr;
      const isCompareSingleDay = cSingleDay;

      if (isMainToday && isCompareSingleDay) {
        const currentHour = now.getUTCHours();
        const filtered = filterByHour(cRows, cAddon, currentHour);
        compare = aggregate(filtered.rows, filtered.addon, true);
      } else {
        compare = aggregate(cRows, cAddon, cSingleDay);
      }
    }

    return NextResponse.json({ current, compare });
  } catch (e) {
    console.error("Sales API error:", e);
    return NextResponse.json(
      { error: "DB 조회 실패", detail: String(e) },
      { status: 500 }
    );
  }
}
