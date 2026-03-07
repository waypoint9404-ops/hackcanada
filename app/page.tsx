import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

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
          {/* Using a simple inline SVG for the Waypoint marker if the generated image isn't reliably available in public/ */}
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
          <Link href="/auth/login" className="w-full" prefetch={false}>
            <Button variant="primary" size="lg" className="w-full text-base">
              Sign In
            </Button>
          </Link>
          <div className="text-center mt-6">
            <p className="text-xs text-text-tertiary" style={{ fontFamily: "var(--font-mono)" }}>
              SECURE WORKER ACCESS ONLY
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
