export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://antek-factura-api.onrender.com';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function decodeJwtClientPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let expectedTenantId: string | null = null;
    let expectedUserId: string | null = null;
    const rawUser = localStorage.getItem('antek_user');
    if (rawUser) {
      try {
        const parsedUser = JSON.parse(rawUser);
        expectedTenantId = parsedUser?.tenantId || null;
        expectedUserId = parsedUser?.id || null;
      } catch {}
    }

    const stored = localStorage.getItem('antek_token');
    if (stored) {
      const jwt = decodeJwtClientPayload(stored);
      const mismatch =
        jwt &&
        ((expectedTenantId && jwt.tenantId && jwt.tenantId !== expectedTenantId) ||
          (expectedUserId && jwt.sub && jwt.sub !== expectedUserId));
      if (!mismatch) {
        return stored;
      }
      localStorage.removeItem('antek_token');
      localStorage.removeItem('antek_tenant_cache');
    }

    const cookieToken = readCookie('antek_client_token') || readCookie('access_token');
    if (cookieToken) {
      localStorage.setItem('antek_token', cookieToken);
      return cookieToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchSessionToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      try {
        localStorage.setItem('antek_token', data.accessToken);
      } catch {}
      return data.accessToken;
    }
  } catch {}
  return null;
}

export async function ensureAuthToken(): Promise<string | null> {
  const existing = getAuthToken();
  if (existing) return existing;
  return fetchSessionToken();
}

async function fetchWithSameOriginFallback(
  path: string,
  init: RequestInit
): Promise<Response> {
  const canUseSameOrigin = typeof window !== 'undefined' && path.startsWith('/v1/');
  if (canUseSameOrigin) {
    try {
      const sameOriginRes = await fetch(path, init);
      if (sameOriginRes.status !== 404 && sameOriginRes.status !== 502 && sameOriginRes.status !== 503 && sameOriginRes.status !== 504) {
        return sameOriginRes;
      }
    } catch {
      // Fallback al dominio directo del API
    }
  }
  return fetch(`${API_BASE_URL}${path}`, init);
}

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const buildHeaders = (token: string | null): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  let token = await ensureAuthToken();
  let res: Response;
  try {
    res = await fetchWithSameOriginFallback(path, {
      ...options,
      credentials: 'include',
      headers: buildHeaders(token),
    });

    if (res.status === 401 && typeof window !== 'undefined') {
      const freshToken = await fetchSessionToken();
      if (freshToken && freshToken !== token) {
        token = freshToken;
        res = await fetchWithSameOriginFallback(path, {
          ...options,
          credentials: 'include',
          headers: buildHeaders(token),
        });
      }
    }
  } catch (networkErr: any) {
    const raw = String(networkErr?.message || '');
    throw new Error(
      /failed to fetch|network/i.test(raw)
        ? 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
        : raw || 'Error de red.'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('antek_token');
      } catch {}
    }
    const err: any = new Error(
      res.status === 401
        ? 'Tu sesión ha expirado o no es válida. Por favor vuelve a iniciar sesión.'
        : typeof data === 'object' && data?.message
        ? data.message
        : `HTTP Error ${res.status}`
    );
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

export async function apiDownload(path: string, fallbackFilename: string): Promise<void> {
  let token = await ensureAuthToken();
  const makeHeaders = (t: string | null): Record<string, string> =>
    t ? { Authorization: `Bearer ${t}` } : {};

  let res = await fetchWithSameOriginFallback(path, {
    method: 'GET',
    credentials: 'include',
    headers: makeHeaders(token),
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    const freshToken = await fetchSessionToken();
    if (freshToken && freshToken !== token) {
      token = freshToken;
      res = await fetchWithSameOriginFallback(path, {
        method: 'GET',
        credentials: 'include',
        headers: makeHeaders(token),
      });
    }
  }

  if (!res.ok) {
    let msg = `Error descargando archivo (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.message) msg = errData.message;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const ECF_TYPE_LABELS: Record<number, string> = {
  31: '31 - Factura de Crédito Fiscal Electrónica',
  32: '32 - Factura de Consumo Electrónica',
  33: '33 - Nota de Débito Electrónica',
  34: '34 - Nota de Crédito Electrónica',
  41: '41 - Comprobante de Compras Electrónico',
  43: '43 - Comprobante Gastos Menores Electrónico',
  44: '44 - Regímenes Especiales Electrónica',
  45: '45 - Gubernamental Electrónica',
  46: '46 - Comprobante Exportaciones Electrónico',
  47: '47 - Pagos al Exterior Electrónico',
};

export function formatDOP(val?: number | null): string {
  if (val === undefined || val === null) return 'RD$ 0.00';
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(val);
}

export function formatRoleLabel(role?: string | null): string {
  const upper = String(role || 'BILLER').toUpperCase();
  if (upper === 'SUPERADMIN') return 'SUPER-ADMIN';
  if (upper === 'ADMIN') return 'ADMIN';
  if (upper === 'ACCOUNTANT') return 'CONTADOR';
  return 'CLIENTE';
}

export function formatClientCode(id?: string | null): string {
  if (!id) return 'CLI-PENDIENTE';
  const clean = String(id).replace(/[^a-zA-Z0-9]/g, '');
  return `CLI-${clean.slice(0, 8).toUpperCase()}`;
}
