import { getAdminAuth } from "@oc/auth-admin";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PrefetchBurst } from "@/components/layout/PrefetchBurst";
import { AdminShell } from "@/components/shell/AdminShell";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const auth = await getAdminAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/login");
  }

  const role = session.user.role;
  if (role !== "admin" && role !== "manager") {
    redirect("/auth/access-denied");
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state");
  const defaultSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : true;

  return (
    <PrefetchBurst>
      <AdminShell defaultSidebarOpen={defaultSidebarOpen}>{children}</AdminShell>
    </PrefetchBurst>
  );
}
