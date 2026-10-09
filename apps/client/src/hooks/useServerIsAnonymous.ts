import type { SessionUser } from "@oc/types";
import { usePageContext } from "vike-react/usePageContext";

export function useServerIsAnonymous(): boolean {
  const serverUser: SessionUser | null = usePageContext().user ?? null;
  return serverUser?.isAnonymous ?? true;
}
