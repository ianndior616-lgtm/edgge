import type { MeResponse, ProfilesResponse, ProfileUpdate, UserWithProfile } from "./types";

export type {
  AdminUserUpdate,
  AdminUsersResponse,
  AdminUserView,
  CheckinResponse,
  MeResponse,
  ProfilesResponse,
  ProfileUpdate,
  PublicProfile,
  RoleId,
  UserWithProfile,
  VerifyResponse,
} from "./types";

type ApiError = { error?: string };

/** Обёртка над fetch: передаёт initData Telegram для авторизации на сервере */
export async function api<T>(
  path: string,
  initData: string | null,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(initData ? { "x-init-data": initData } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const data = (await res.json().catch(() => null)) as
    | (T & ApiError)
    | null;
  if (!res.ok) {
    throw new Error(data?.error ?? `Ошибка запроса (${res.status})`);
  }
  return data as T;
}
