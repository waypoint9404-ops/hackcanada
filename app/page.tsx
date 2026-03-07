import { auth0 } from "@/lib/auth0";
import { syncUser } from "@/lib/user-sync";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <main className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Waypoint</h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Municipal Outreach Case Management
          </p>
          <div className="flex gap-4">
            <a
              href="/auth/login?screen_hint=signup"
              className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Sign Up
            </a>
            <a
              href="/auth/login"
              className="rounded-full border border-black/[.08] px-6 py-3 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Log In
            </a>
          </div>
        </main>
      </div>
    );
  }

  // Sync Auth0 user → Supabase (idempotent upsert)
  const { data: profile } = await syncUser(session.user);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Waypoint</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Welcome, {profile?.name || session.user.email}
        </p>

        <div className="flex gap-4">
          <a
            href="/profile"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            My Profile
          </a>
          <a
            href="/auth/logout"
            className="rounded-full border border-black/[.08] px-6 py-3 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Log Out
          </a>
        </div>
      </main>
    </div>
  );
}
