// AuthShell.tsx  -  composes QueryProvider + AuthProvider as a single client island.

import { AuthProvider, QueryProvider } from "@oc/api-client";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AuthShell({ children }: Props) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
