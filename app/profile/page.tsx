import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import Link from "next/link";
import { syncUser, getProfile } from "@/lib/user-sync";
import { updateProfile } from "./actions";

export default async function ProfilePage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Ensure user exists in Supabase, then fetch full profile
  await syncUser(session.user);
  const { data: profile } = await getProfile(session.user.sub);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex w-full max-w-md flex-col gap-8 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            &larr; Back
          </Link>
        </div>

        <form action={updateProfile} className="flex flex-col gap-5">
          {/* Email (read-only, from Auth0) */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-zinc-500"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={session.user.email ?? ""}
              disabled
              className="rounded-md border border-black/10 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-900"
            />
            <p className="text-xs text-zinc-400">
              Managed by Auth0 — cannot be changed here.
            </p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-zinc-500">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={profile?.name ?? ""}
              placeholder="Your full name"
              className="rounded-md border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-white/10 dark:bg-zinc-950"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="phone"
              className="text-sm font-medium text-zinc-500"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
              placeholder="+1 (555) 000-0000"
              className="rounded-md border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-white/10 dark:bg-zinc-950"
            />
          </div>

          {/* Role (read-only) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className="text-sm font-medium text-zinc-500">
              Role
            </label>
            <input
              id="role"
              type="text"
              value={profile?.role ?? "social_worker"}
              disabled
              className="rounded-md border border-black/10 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-900"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Save Changes
          </button>
        </form>
      </main>
    </div>
  );
}
