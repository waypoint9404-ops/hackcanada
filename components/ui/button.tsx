"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-expo transition-colors select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-accent";

    const variants: Record<string, string> = {
      primary:
        "bg-accent text-white hover:bg-accent-hover active:bg-accent-hover",
      secondary:
        "bg-bg-surface text-text-primary border border-border-subtle hover:bg-bg-elevated active:bg-bg-elevated",
      ghost:
        "bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
      danger:
        "bg-status-high-bg text-status-high-text hover:opacity-90",
    };

    const sizes: Record<string, string> = {
      sm: "text-xs px-3 py-2 min-h-[36px] rounded-sm",
      md: "text-sm px-4 py-2.5 min-h-[44px] rounded-sm",
      lg: "text-sm px-6 py-3 min-h-[48px] rounded-sm",
      icon: "p-0 min-h-0 rounded-sm",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${
          disabled ? "opacity-40 pointer-events-none" : ""
        } ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
export type { ButtonProps };
