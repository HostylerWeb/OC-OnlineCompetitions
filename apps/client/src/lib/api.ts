import { app } from "@oc/api-server/app";

export async function callApi(request: Request): Promise<Response> {
  return app.fetch(request);
}

export async function fetchJson<T>(
  path: string,
  init?: { method?: string; body?: unknown; headers?: HeadersInit }
): Promise<{ data: T } | null> {
  const url = new URL(path, "http://localhost");
  const request = new Request(url, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const res = await app.fetch(request);
  if (!res.ok) return null;
  return (await res.json()) as { data: T };
}
