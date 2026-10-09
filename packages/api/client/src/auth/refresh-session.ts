import { getGlobalQueryClient } from "../query-client";
import { updateSessionSnapshot } from "./session-snapshot";

/** Fetch session from API and update the session snapshot before client-side redirects. */
export async function refreshAuthSession(): Promise<void> {
  const queryClient = getGlobalQueryClient();
  await queryClient.invalidateQueries({ queryKey: ["session"] });
  try {
    const { authClient } = await import("@oc/auth-client");
    const result = await authClient.getSession();
    updateSessionSnapshot(result?.data ?? null);
  } catch {
    updateSessionSnapshot(null);
  }
}
