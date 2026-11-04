// 포털(biteme-portal-hub)이 iframe 주소에 붙여 주는 1시간짜리 출입증(portal_token)을
// 이 탭 동안 보관하고, 모든 /api 요청에 붙인다.

const STORAGE_KEY = "portal_token";
export const AUTH_EXPIRED_EVENT = "portal-auth-expired";

let memoryToken: string | null = null;

export function getPortalToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get(STORAGE_KEY);
  if (fromUrl) {
    memoryToken = fromUrl;
    try {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {}
    url.searchParams.delete(STORAGE_KEY);
    window.history.replaceState({}, "", url.toString());
    return memoryToken;
  }

  try {
    memoryToken = sessionStorage.getItem(STORAGE_KEY);
  } catch {}
  return memoryToken;
}

export async function apiFetch(input: string): Promise<Response> {
  const token = getPortalToken();
  const res = await fetch(input, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
}
