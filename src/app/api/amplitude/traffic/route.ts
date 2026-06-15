import { NextRequest } from "next/server";
import { querySegmentation, parseTrend, parseGroupBy } from "@/lib/amplitude";
import { query as dbQuery } from "@/lib/db";
import { brandPartMapSQL, productPartMapSQL } from "@/lib/queries";

function toAmpDate(d: string) {
  return d.replace(/-/g, "");
}

interface BrandPartRow {
  brand_cd: string;
  brand_nm: string;
  part: string;
}

interface ProductPartRow {
  item_id: string;
  item_name: string;
  brand_nm: string;
  part: string;
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

  const ampStart = toAmpDate(start);
  const ampEnd = toAmpDate(end);

  try {
    let brandPartRows: BrandPartRow[] = [];
    let productPartRows: ProductPartRow[] = [];

    const rdsPromise = Promise.all([
      dbQuery<BrandPartRow>(brandPartMapSQL()),
      dbQuery<ProductPartRow>(productPartMapSQL()),
    ])
      .then(([b, p]) => {
        brandPartRows = b;
        productPartRows = p;
      })
      .catch((e) => console.warn("RDS mapping unavailable:", e));

    const [totalViewsRes, totalPurchasesRes] = await Promise.all([
      querySegmentation({
        eventType: "view_detailpage",
        metric: "uniques",
        start: ampStart,
        end: ampEnd,
      }),
      querySegmentation({
        eventType: "complete_item_order",
        metric: "uniques",
        start: ampStart,
        end: ampEnd,
      }),
    ]);

    const [brandViewsRes, brandPurchasesRes] = await Promise.all([
      querySegmentation({
        eventType: "view_detailpage",
        metric: "uniques",
        start: ampStart,
        end: ampEnd,
        groupBy: { type: "event", value: "brand_name" },
        limit: 100,
      }),
      querySegmentation({
        eventType: "complete_item_order",
        metric: "uniques",
        start: ampStart,
        end: ampEnd,
        groupBy: { type: "event", value: "brand_name" },
        limit: 100,
      }),
    ]);

    const [productViewsRes, productPurchasesRes] = await Promise.all([
      querySegmentation({
        eventType: "view_detailpage",
        metric: "uniques",
        start: ampStart,
        end: ampEnd,
        groupBy: { type: "event", value: "item_id" },
        limit: 100,
      }),
      querySegmentation({
        eventType: "complete_item_order",
        metric: "uniques",
        start: ampStart,
        end: ampEnd,
        groupBy: { type: "event", value: "item_id" },
        limit: 100,
      }),
    ]);

    await rdsPromise;

    const brandPartMap = new Map<string, string>();
    for (const row of brandPartRows) {
      brandPartMap.set(row.brand_nm, row.part);
    }

    const productInfoMap = new Map<
      string,
      { item_name: string; brand_nm: string; part: string }
    >();
    for (const row of productPartRows) {
      productInfoMap.set(row.item_id, {
        item_name: row.item_name,
        brand_nm: row.brand_nm,
        part: row.part,
      });
    }

    const brandViews = parseGroupBy(brandViewsRes);
    const brandPurchases = parseGroupBy(brandPurchasesRes);
    const brandPurchaseMap = new Map(
      brandPurchases.map((b) => [b.name, b.users])
    );

    const brands = brandViews
      .filter((b) => b.name !== "(none)")
      .map((b) => {
        const views = b.users;
        const purchases = brandPurchaseMap.get(b.name) || 0;
        const cvr =
          views > 0 ? Math.round((purchases / views) * 10000) / 100 : 0;
        return {
          name: b.name,
          part: brandPartMap.get(b.name) || "미분류",
          views,
          purchases,
          cvr,
        };
      });

    const productViews = parseGroupBy(productViewsRes);
    const productPurchases = parseGroupBy(productPurchasesRes);
    const productPurchaseMap = new Map(
      productPurchases.map((p) => [p.name, p.users])
    );

    const products = productViews
      .filter((p) => p.name !== "(none)")
      .map((p) => {
        const views = p.users;
        const purchases = productPurchaseMap.get(p.name) || 0;
        const cvr =
          views > 0 ? Math.round((purchases / views) * 10000) / 100 : 0;
        const mapping = productInfoMap.get(p.name);
        return {
          name: mapping?.item_name || p.name,
          brand_nm: mapping?.brand_nm || "",
          part: mapping?.part || "미분류",
          views,
          purchases,
          cvr,
        };
      });

    const totalViewers = parseTrend(totalViewsRes).total;
    const totalBuyers = parseTrend(totalPurchasesRes).total;
    const totalCvr =
      totalViewers > 0
        ? Math.round((totalBuyers / totalViewers) * 10000) / 100
        : 0;

    return Response.json({
      summary: { viewers: totalViewers, buyers: totalBuyers, cvr: totalCvr },
      brands,
      products,
    });
  } catch (e) {
    console.error("Traffic API error:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
