interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = "", lines = 3 }: SkeletonProps) {
  const widths = ["100%", "85%", "70%", "90%", "60%"];
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-4"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}
