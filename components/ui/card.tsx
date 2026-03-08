import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ elevated = false, interactive = false, className = "", children, ...props }, ref) => {
    const base = "bg-bg-surface border border-border-subtle rounded-sm";
    const shadow = elevated ? "shadow-[var(--shadow-md)]" : "shadow-[var(--shadow-sm)]";
    const hover = interactive
      ? "cursor-pointer hover:shadow-[var(--shadow-md)] hover:-translate-y-0.7 hover:scale-[1.07] hover:border-border-strong transition-expo transition-all duration-300"
      : "";

    return (
      <div
        ref={ref}
        className={`${base} ${shadow} ${hover} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
export { Card };
export type { CardProps };
