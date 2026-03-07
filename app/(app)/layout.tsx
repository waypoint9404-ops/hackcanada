import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import { syncUser } from "@/lib/user-sync";
import { BottomNav } from "@/components/ui/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  // Sync Auth0 → Supabase on every page load (idempotent)
  await syncUser(session.user);

  return (
    <div className="min-h-dvh pb-[72px]">
      {children}
      <BottomNav />
    </div>
  );
}
