import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import { syncUser, getProfile } from "@/lib/user-sync";
import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GoogleCalendarConnect } from "@/components/schedule/google-cal-connect";

export default async function ProfilePage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Ensure user exists in Supabase, then fetch full profile
  await syncUser(session.user);
  const { data: profile } = await getProfile(session.user.sub);

  return (
    <main className="px-5 py-8 max-w-lg mx-auto pb-8">
      <header className="mb-8">
        <h1 className="heading-display text-4xl mb-2 text-text-primary">
          Profile
        </h1>
        <p className="text-sm text-text-secondary">
          Manage your account details and preferences.
        </p>
      </header>

      <Card className="p-6 mb-8">
        <form action={updateProfile} className="flex flex-col gap-5">
          {/* Email (read-only, from Auth0) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text-secondary">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={session.user.email ?? ""}
              disabled
              className="rounded-sm border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-tertiary focus:outline-none"
            />
            <p className="text-xs text-text-tertiary mt-0.5">
              Managed securely by Auth0.
            </p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-text-secondary">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={profile?.name ?? ""}
              placeholder="Your full name"
              className="rounded-sm border border-border-subtle bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong transition-colors"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-text-secondary">
              Direct Contact
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
              placeholder="+1 (555) 000-0000"
              className="rounded-sm border border-border-subtle bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong transition-colors"
            />
          </div>

          {/* Role (read-only) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className="text-sm font-medium text-text-secondary">
              Assigned Role
            </label>
            <input
              id="role"
              type="text"
              value={(profile?.role ?? "social_worker").replace(/_/g, " ").toUpperCase()}
              disabled
              className="rounded-sm border border-border-subtle bg-bg-base px-3 py-2.5 text-sm font-mono tracking-wide text-text-tertiary focus:outline-none"
            />
          </div>

          <div className="pt-2 mt-2 border-t border-border-subtle">
            <Button type="submit" variant="primary" className="w-full">
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Google Calendar Integration */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest font-mono mb-3">
          Integrations
        </h2>
        <GoogleCalendarConnect />
      </div>

      <div className="flex flex-col gap-4">
        <a href="/auth/logout" className="block">
          <Button variant="ghost" className="w-full border border-border-subtle text-status-high-text hover:bg-status-high-bg hover:text-status-high-text hover:border-status-high-text/30">
            Sign Out Securely
          </Button>
        </a>
      </div>
    </main>
  );
}
