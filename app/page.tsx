import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth0.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Graphic Element */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full border border-border-subtle opacity-50 -top-40 -right-40 pointer-events-none" 
        style={{ zIndex: -1 }}
      />
      <div 
        className="absolute w-[600px] h-[600px] rounded-full border border-border-subtle opacity-30 -bottom-40 -left-20 pointer-events-none" 
        style={{ zIndex: -1 }}
      />

      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo Icon */}
        <div className="mb-8 w-16 h-16 rounded-2xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-center text-accent">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="currentColor"/>
          </svg>
        </div>

        <h1 className="heading-display tracking-tight text-5xl mb-3 text-center text-text-primary">
          Waypoint
        </h1>
        <p className="text-text-secondary text-center mb-10 text-[15px] leading-relaxed max-w-[280px]">
          Municipal case management, designed for social workers on the ground.
        </p>

        <div className="w-full flex flex-col gap-3">
          {/* Passwordless Email Sign-In — PIPEDA-compliant, no password stored */}
          <a
            href="/auth/login?connection=email"
            className="w-full inline-flex items-center justify-center gap-2.5 font-medium text-base min-h-[48px] rounded-sm px-6 py-3 transition-expo transition-colors select-none cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)', color: '#FFFFFF' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="currentColor"/>
            </svg>
            Sign In with Email Code
          </a>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="text-xs text-text-tertiary uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          {/* Google Social Login */}
          <a
            href="/auth/login?connection=google-oauth2"
            className="w-full inline-flex items-center justify-center gap-2.5 font-medium text-base min-h-[48px] rounded-sm px-6 py-3 transition-expo transition-colors select-none cursor-pointer bg-bg-surface border border-border-strong text-text-primary hover:bg-bg-surface-elevated"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign In with Google
          </a>

          {/* GitHub Social Login */}
          <a
            href="/auth/login?connection=github"
            className="w-full inline-flex items-center justify-center gap-2.5 font-medium text-base min-h-[48px] rounded-sm px-6 py-3 transition-expo transition-colors select-none cursor-pointer bg-bg-surface border border-border-strong text-text-primary hover:bg-bg-surface-elevated"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            Sign In with GitHub
          </a>

          <div className="text-center mt-6">
            <p className="text-xs text-text-tertiary leading-relaxed max-w-[260px] mx-auto mb-2">
              Passwordless sign-in recommended for PIPEDA compliance — no credentials stored.
            </p>
            <p className="text-xs text-text-tertiary" style={{ fontFamily: "var(--font-mono)" }}>
              SECURE WORKER ACCESS ONLY
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
