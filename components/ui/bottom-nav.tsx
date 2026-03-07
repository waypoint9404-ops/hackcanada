"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserCircle } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/dashboard", label: "Clients", icon: Users },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-bg-surface border-t border-border-subtle"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 min-h-[56px] text-center transition-expo transition-colors ${
                isActive
                  ? "text-accent"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <Icon 
                size={22} 
                strokeWidth={isActive ? 2.5 : 2} 
                className={isActive ? "text-accent" : ""} 
              />
              <span
                className="text-[0.625rem] font-medium tracking-wide uppercase"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
