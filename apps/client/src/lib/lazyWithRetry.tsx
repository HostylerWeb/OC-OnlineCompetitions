import { type ComponentType, lazy } from "react";

const CHUNK_RELOAD_SESSION_KEY = "onlinecompetitions-chunk-reload";

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
}

async function importWithChunkReload<T>(factory: () => Promise<T>): Promise<T> {
  try {
    const module = await factory();
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
    return module;
  } catch (error) {
    if (!isChunkLoadError(error)) throw error;

    const reloaded = sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY);
    if (!reloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, "1");
      window.location.reload();
      return new Promise(() => {});
    }

    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
    throw error;
  }
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() => importWithChunkReload(factory));
}
