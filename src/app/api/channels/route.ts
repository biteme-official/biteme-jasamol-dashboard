import { NextRequest } from "next/server";
import { fetchChannelDAU } from "@/lib/airbridge";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return Response.json({ error: "start and end required" }, { status: 400 });
  }

  try {
    const channels = await fetchChannelDAU(start, end);

    const grandApp = channels.reduce((s, c) => s + c.app, 0);
    const grandWeb = channels.reduce((s, c) => s + c.web, 0);
    const grandTotal = grandApp + grandWeb;

    const withShare = channels.map((c) => ({
      ...c,
      share: grandTotal > 0 ? Math.round((c.total / grandTotal) * 10000) / 100 : 0,
    }));

    return Response.json({
      channels: withShare,
      grandTotal: { app: grandApp, web: grandWeb, total: grandTotal },
    });
  } catch (e) {
    console.error("Channels API error:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
