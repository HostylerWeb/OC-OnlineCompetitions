import { getAdminAuth } from "@oc/auth-admin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PrefetchBurst } from "@/components/layout/PrefetchBurst";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAdminAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/login");
  }

  if (session.user.role !== "admin" && session.user.role !== "manager") {
    redirect("/auth/access-denied");
  }

  return <PrefetchBurst>{children}</PrefetchBurst>;
}
