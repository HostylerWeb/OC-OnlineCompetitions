import { useAuth } from "@oc/api-client";
import type { User } from "@oc/types";

export function useUser(): User | null {
  const { user: authUser } = useAuth();
  return authUser;
}
