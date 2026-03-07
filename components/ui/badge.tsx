interface StatusBadgeProps {
  level: "HIGH" | "MED" | "LOW";
}

const statusConfig = {
  HIGH: { label: "HIGH", className: "status-high", dot: "🔴" },
  MED: { label: "MED", className: "status-med", dot: "🟠" },
  LOW: { label: "LOW", className: "status-low", dot: "🟢" },
};

export function StatusBadge({ level }: StatusBadgeProps) {
  const config = statusConfig[level] || statusConfig.LOW;
  return (
    <span className={`status-badge ${config.className}`}>
      <span style={{ fontSize: "0.5rem" }}>{config.dot}</span>
      {config.label}
    </span>
  );
}

interface TagBadgeProps {
  tag: string;
}

export function TagBadge({ tag }: TagBadgeProps) {
  return <span className="tag-badge">{tag.replace(/_/g, " ")}</span>;
}
