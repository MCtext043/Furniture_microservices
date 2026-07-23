import { z } from 'zod';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const TOKEN_KEY = 'furniture_jwt';

const statusMessages: Record<number, string> = {
  401: 'Сессия истекла. Войдите снова.',
  403: 'Недостаточно прав для этого действия.',
  404: 'Запрошенные данные не найдены.',
  409: 'Данные конфликтуют с существующей записью.',
  422: 'Проверьте заполненные поля.',
  500: 'Внутренняя ошибка сервера.',
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorMessage(data: unknown, status: number) {
  if (typeof data === 'object' && data && 'detail' in data) {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((row) => typeof row === 'object' && row && 'msg' in row ? String(row.msg) : String(row)).join(', ');
  }
  return statusMessages[status] ?? `Ошибка запроса (${status})`;
}

export async function request<T>(path: string, init: RequestInit = {}, schema?: z.ZodType<T>): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
  const raw = await response.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError(errorMessage(data, response.status), response.status, data);
  }
  if (!schema) return data as T;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError('Backend вернул данные неожиданного формата.', response.status, parsed.error.flatten());
  return parsed.data;
}

export const api = {
  get: <T>(path: string, schema?: z.ZodType<T>, signal?: AbortSignal) => request<T>(path, { signal }, schema),
  post: <T>(path: string, body?: unknown, schema?: z.ZodType<T>) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, schema),
  patch: <T>(path: string, body: unknown, schema?: z.ZodType<T>) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, schema),
  put: <T>(path: string, body: unknown, schema?: z.ZodType<T>) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, schema),
  delete: (path: string) => request<null>(path, { method: 'DELETE' }),
};

const photo = z.object({ id: z.number(), product_id: z.number(), object_key: z.string(), sort_order: z.number() });
const product = z.object({ id: z.number(), name: z.string(), sku: z.string(), brand: z.string(), description: z.string(), price: z.coerce.number(), stock: z.number(), category_id: z.number().nullable(), is_active: z.boolean(), photos: z.array(photo) });
const category = z.object({ id: z.number(), name: z.string(), parent_id: z.number().nullable() });
const cartItem = z.object({ id: z.number(), user_id: z.string(), product_id: z.number(), quantity: z.number() });
const wishlistItem = z.object({ id: z.number(), user_id: z.string(), product_id: z.number() });
const furniture = z.object({ id: z.number(), project_id: z.number(), name: z.string(), width: z.coerce.number(), depth: z.coerce.number(), height: z.coerce.number(), x: z.coerce.number(), y: z.coerce.number(), z: z.coerce.number(), rotation_y: z.coerce.number(), furniture_type: z.string(), texture: z.string(), custom_color: z.string(), drawers: z.number(), handles: z.number() });
const project = z.object({ id: z.number(), name: z.string(), location: z.string(), user_id: z.string().nullable(), room_width: z.coerce.number(), room_length: z.coerce.number(), room_height: z.coerce.number(), price_standard: z.coerce.number().nullable(), price_comfort: z.coerce.number().nullable(), price_premium: z.coerce.number().nullable(), bom_json: z.string(), selected_tier: z.string(), status: z.string(), submitted_at: z.string().nullable() });
const order = z.object({ id: z.number(), title: z.string(), customer: z.string(), status: z.string(), notes: z.string(), planner_project_id: z.number().nullable(), user_id: z.string().nullable(), price_standard: z.coerce.number().nullable(), price_comfort: z.coerce.number().nullable(), price_premium: z.coerce.number().nullable(), selected_tier: z.string(), materials: z.array(z.object({ material_id: z.number(), material_name: z.string(), unit: z.string(), required_qty: z.coerce.number() })) });
const material = z.object({ id: z.number(), name: z.string(), unit: z.string() });

export const schemas = { photo, product, category, cartItem, wishlistItem, furniture, project, order, material, me: z.object({ sub: z.string(), username: z.string(), roles: z.array(z.string()) }), token: z.object({ access_token: z.string(), token_type: z.string(), expires_in: z.number() }) };
export type Product = z.infer<typeof product>;
export type Category = z.infer<typeof category>;
export type CartItem = z.infer<typeof cartItem>;
export type WishlistItem = z.infer<typeof wishlistItem>;
export type ApiFurniture = z.infer<typeof furniture>;
export type Project = z.infer<typeof project>;
export type Order = z.infer<typeof order>;
export const assetUrl = (key: string) => `${API_BASE_URL}/assets/objects/${key.split('/').map(encodeURIComponent).join('/')}`;
