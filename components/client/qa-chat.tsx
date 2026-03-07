"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface QAChatProps {
  clientId: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function QAChat({ clientId }: QAChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          question: userMsg.content,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to get answer");

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "⚠️ Sorry, I encountered an error answering that. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col border border-border-subtle rounded-sm bg-bg-surface overflow-hidden">
      <div className="bg-bg-elevated px-4 py-2 border-b border-border-subtle">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
           Case Q&A
        </h3>
      </div>

      <div className="flex-1 max-h-[300px] overflow-y-auto p-4 flex flex-col gap-4">
        {messages.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center my-8 italic">
            Ask questions about this client's history.
            <br />e.g., "What was their last housing update?"
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-md px-3 py-2 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-text-primary text-bg-base self-end rounded-br-none"
                  : "bg-bg-elevated text-text-primary self-start rounded-bl-none border border-border-subtle"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="bg-bg-elevated self-start rounded-md rounded-bl-none px-4 py-3 border border-border-subtle">
            <div className="flex gap-1.5 items-center">
              <div className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-1" />
      </div>

      <form onSubmit={handleSubmit} className="p-2 border-t border-border-subtle bg-bg-base flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-bg-surface border border-border-subtle rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          disabled={loading}
        />
        <Button 
          type="submit" 
          disabled={!input.trim() || loading}
          className="px-3"
        >
          Send
        </Button>
      </form>
    </div>
  );
}
