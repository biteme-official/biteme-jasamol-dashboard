"use client";

import { useEffect, useState } from "react";
import { getPortalToken, AUTH_EXPIRED_EVENT } from "@/lib/portal-token";

const PORTAL_URL = "https://biteme-portal-hub.vercel.app";

type State = "checking" | "ok" | "none" | "expired";

export default function PortalGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    setState(getPortalToken() ? "ok" : "none");
    const onExpired = () => setState("expired");
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-3">
        <h1 className="text-lg font-semibold">
          {state === "expired" ? "접속 시간이 끝났습니다" : "포털에서 열어 주세요"}
        </h1>
        <p className="text-sm text-gray-500">
          {state === "expired"
            ? "포털 화면을 새로고침하면 다시 볼 수 있습니다."
            : "이 대시보드는 바잇미 포털에 구글 계정으로 로그인한 뒤 볼 수 있습니다."}
        </p>
        {state === "none" && (
          <a
            href={PORTAL_URL}
            target="_top"
            className="inline-block text-sm font-medium text-blue-600 underline"
          >
            포털로 이동
          </a>
        )}
      </div>
    </main>
  );
}
