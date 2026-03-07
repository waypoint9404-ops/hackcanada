"use client";

import { useMemo } from "react";

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for case notes and AI output.
 * Handles: **bold**, *italic*, ## headers, - bullet lists, numbered lists, `code`, and line breaks.
 */
export function Markdown({ content, className = "" }: MarkdownProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let result = escapeHtml(text);
  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");
  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  return result;
}

function renderMarkdown(raw: string): string {
  if (!raw) return "";

  const lines = raw.split("\n");
  const out: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      if (inList) { out.push(`</${listType}>`); inList = false; listType = null; }
      out.push(`<h4 class="md-h3">${renderInline(line.slice(4))}</h4>`);
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) { out.push(`</${listType}>`); inList = false; listType = null; }
      out.push(`<h3 class="md-h2">${renderInline(line.slice(3))}</h3>`);
      continue;
    }
    if (line.startsWith("# ")) {
      if (inList) { out.push(`</${listType}>`); inList = false; listType = null; }
      out.push(`<h2 class="md-h1">${renderInline(line.slice(2))}</h2>`);
      continue;
    }

    // Unordered list items: - or *
    const ulMatch = line.match(/^[\s]*[-*]\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        if (inList) out.push(`</${listType}>`);
        out.push("<ul class=\"md-ul\">");
        inList = true;
        listType = "ul";
      }
      out.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list items: 1. 2. etc.
    const olMatch = line.match(/^[\s]*\d+\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        if (inList) out.push(`</${listType}>`);
        out.push("<ol class=\"md-ol\">");
        inList = true;
        listType = "ol";
      }
      out.push(`<li>${renderInline(olMatch[1])}</li>`);
      continue;
    }

    // Close any open list
    if (inList) {
      out.push(`</${listType}>`);
      inList = false;
      listType = null;
    }

    // Empty line
    if (line.trim() === "") {
      out.push('<div class="md-spacer"></div>');
      continue;
    }

    // Regular paragraph
    out.push(`<p class="md-p">${renderInline(line)}</p>`);
  }

  if (inList) out.push(`</${listType}>`);
  return out.join("");
}
