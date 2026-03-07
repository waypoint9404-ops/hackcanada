import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { StatusBadge, TagBadge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AddClientButton } from "@/components/client/add-client-button";

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")       // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")  // bold
    .replace(/\*(.+?)\*/g, "$1")      // italic
    .replace(/__(.+?)__/g, "$1")      // bold alt
    .replace(/_(.+?)_/g, "$1")        // italic alt
    .replace(/`(.+?)`/g, "$1")        // inline code
    .replace(/^[-*]\s+/gm, "")        // bullet lists
    .replace(/^\d+\.\s+/gm, "")       // numbered lists
    .replace(/\n{2,}/g, " ")          // collapse multiple newlines
    .replace(/\n/g, " ")              // remaining newlines
    .trim();
}

export default async function DashboardPage() {
  const session = await auth0.getSession();
  const workerId = session?.user.sub; // Auth0 ID

  const supabase = createAdminClient();

  // 1. Get the worker's Supabase UUID using their Auth0 ID
  const { data: worker } = await supabase
    .from("users")
    .select("id, name")
    .eq("auth0_id", workerId)
    .single();

  // 2. Fetch clients assigned to this worker
  let clients: any[] = [];
  if (worker?.id) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, risk_level, tags, summary")
      .eq("assigned_worker_id", worker.id)
      .order("updated_at", { ascending: false });
    
    if (data) clients = data;
  }

  // Count high risk for summary
  const highRiskCount = clients.filter(c => c.risk_level === "HIGH").length;

  return (
    <main className="px-5 py-8 max-w-lg mx-auto pb-8">
      <header className="mb-8">
        <h1 className="heading-display text-4xl mb-2 text-text-primary">
          Clients
        </h1>
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {clients.length === 0 
              ? "No clients assigned yet." 
              : `${clients.length} assigned to ${worker?.name?.split(' ')[0] ?? 'you'}`}
          </p>
          {highRiskCount > 0 && (
            <span className="text-xs font-medium text-status-high-text bg-status-high-bg px-2.5 py-1 rounded-full">
              {highRiskCount} High Risk
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {clients.length === 0 ? (
          <div className="text-center py-12 px-6 border border-dashed border-border-strong rounded-lg">
            <p className="text-text-secondary text-sm mb-4">You have no active cases assigned.</p>
            <div className="max-w-xs mx-auto">
              <AddClientButton />
            </div>
          </div>
        ) : (
          clients.map((client) => (
            <Link key={client.id} href={`/dashboard/${client.id}`} className="block focus-visible:outline-none rounded-sm">
              <Card interactive className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <h2 className="font-serif text-xl font-normal text-text-primary tracking-tight">
                    {client.name}
                  </h2>
                  <StatusBadge level={client.risk_level} />
                </div>
                
                <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
                  {client.summary ? stripMarkdown(client.summary) : "No active summary."}
                </p>

                {client.tags && client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 mt-1 border-t border-border-subtle w-fit">
                    {client.tags.slice(0, 3).map((tag: string) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                    {client.tags.length > 3 && (
                      <span className="text-xs text-text-tertiary mt-0.5 font-mono">
                        +{client.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </Card>
            </Link>
          ))
        )}
      </div>

      <div className="mt-8">
        <AddClientButton />
        <p className="text-center text-xs text-text-tertiary mt-3">
          New clients are auto-provisioned seamlessly via voice ingestion.
        </p>
      </div>
    </main>
  );
}
