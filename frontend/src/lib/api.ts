// Cliente da API NutriSnap. O token fica no localStorage deste navegador.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
const KEY = 'nutrisnap_token';

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;
  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* navegador sem storage */ }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const tok = getToken();
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: opts.method || 'GET', headers, body });
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique sua internet e tente de novo.', 0);
  }
  let data: any = {};
  try { data = await res.json(); } catch { /* resposta sem corpo */ }
  if (!res.ok) throw new ApiError(data.error || 'Algo deu errado. Tente novamente.', res.status, data.code, data);
  return data as T;
}

// Data de hoje (AAAA-MM-DD) no fuso de São Paulo.
export function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
// Dia da semana de hoje em São Paulo ('Dom'...'Sáb').
export function todayWeekday(): string {
  const w = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date()).replace('.', '');
  const m: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', 'sáb': 'Sáb', sab: 'Sáb', dom: 'Dom' };
  return m[w.toLowerCase()] || 'Seg';
}

export interface Usage {
  plan: 'teste' | 'essencial' | 'pro' | 'power';
  used: number; limit: number; remaining: number;
  daily_used: number; daily_limit: number;
  active_until?: string; canceled?: boolean;
}
