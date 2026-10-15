import { cookies } from "next/headers";
import { shopApiApp } from "@/lib/shop-api-app";

const DEFAULT_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * Server-only shop API calls via in-process Hono (avoids localhost HTTP deadlock in Next dev).
 */
export async function serverFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const url = new URL(path, "http://shop.internal");
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  const cookieHeader = cookieStore.toString();
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  const request = new Request(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body,
  });

  const res = await withTimeout(shopApiApp.fetch(request), DEFAULT_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}`);
  }

  return res.json() as Promise<T>;
}
