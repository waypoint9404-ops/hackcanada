"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { CalendarPlus, AlertTriangle } from "lucide-react";

interface SuggestionClient {
  id: string;
  name: string;
  risk_level: "HIGH" | "MED" | "LOW";
  tags: string[];
}

interface TriageSuggestion {
  client: SuggestionClient;
  score: number;
  reasons: string[];
}

interface SuggestionCardProps {
  suggestion: TriageSuggestion;
  onSchedule?: (clientId: string, clientName: string) => void;
}

export function SuggestionCard({ suggestion, onSchedule }: SuggestionCardProps) {
  const { client, reasons } = suggestion;
  const isUrgent = client.risk_level === "HIGH";

  return (
    <Card
      className={`p-4 ${
        isUrgent ? "border-l-[3px] border-l-status-high-text" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Client name + risk */}
          <div className="flex items-center gap-2 mb-1.5">
            {isUrgent && (
              <AlertTriangle
                size={14}
                className="text-status-high-text flex-shrink-0"
              />
            )}
            <Link
              href={`/dashboard/${client.id}`}
              className="text-text-primary font-medium hover:text-accent transition-colors"
            >
              {client.name}
            </Link>
            <StatusBadge level={client.risk_level as "HIGH" | "MED" | "LOW"} />
          </div>

          {/* Reason chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {reasons.map((reason, i) => (
              <span
                key={i}
                className="text-[11px] font-mono text-text-tertiary bg-bg-elevated px-2 py-0.5 rounded-sm border border-border-subtle"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule button */}
      {onSchedule && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSchedule(client.id, client.name)}
            className="w-full gap-1.5"
          >
            <CalendarPlus size={14} /> Schedule Visit
          </Button>
        </div>
      )}
    </Card>
  );
}
