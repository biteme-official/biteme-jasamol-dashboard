import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 모든 /api 요청은 포털이 발급한 출입증(portal_token)이 있어야 응답한다.
// 출입증 진위는 포털의 /api/auth/verify-token 에 묻는다.
const PORTAL_URL = process.env.PORTAL_URL || "https://biteme-portal-hub.vercel.app";
const DASHBOARD_SLUG = "jasamol-dashboard";
const CACHE_MS = 5 * 60 * 1000;

const verified = new Map<string, number>(); // token -> 캐시 만료 시각

async function isValid(token: string): Promise<boolean> {
  const now = Date.now();
  const until = verified.get(token);
  if (until && until > now) return true;

  try {
    const res = await fetch(`${PORTAL_URL}/api/auth/verify-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.valid || data.user?.slug !== DASHBOARD_SLUG) return false;
  } catch {
    return false;
  }

  if (verified.size > 500) verified.clear();
  verified.set(token, now + CACHE_MS);
  return true;
}

export async function proxy(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token && (await isValid(token))) return NextResponse.next();
  return NextResponse.json({ error: "포털에서 다시 열어 주세요." }, { status: 401 });
}

export const config = {
  matcher: "/api/:path*",
};
