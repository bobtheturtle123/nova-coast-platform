"use client";
import React from "react";

// Lightweight Markdown-ish rendering for product descriptions. We store the raw
// text (which survives the server's stripTags because it's plain characters:
// **bold**, *italic*, and "- " bullet lines) and format it only at display time.
// No HTML is ever injected — everything is real React elements, so there's no
// XSS surface.

const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;

function renderInline(text, keyPrefix) {
  return text
    .split(INLINE_RE)
    .filter((p) => p !== "" && p != null)
    .map((p, i) => {
      const key = `${keyPrefix}${i}`;
      if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) return <strong key={key}>{p.slice(2, -2)}</strong>;
      if (p.length > 2 && p.startsWith("*")  && p.endsWith("*"))  return <em key={key}>{p.slice(1, -1)}</em>;
      if (p.length > 2 && p.startsWith("_")  && p.endsWith("_"))  return <em key={key}>{p.slice(1, -1)}</em>;
      return <React.Fragment key={key}>{p}</React.Fragment>;
    });
}

// Render formatted description text as paragraphs + bullet lists.
export function RichText({ text, className, style }) {
  if (!text) return null;
  const lines  = String(text).split(/\r?\n/);
  const blocks = [];
  let para = [];
  let list = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: "p",  lines: para }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ type: list.ordered ? "ol" : "ul", items: list.slice() }); list = []; list.ordered = false; } };

  for (const raw of lines) {
    const t = raw.trim();
    if (/^\d+[.)]\s+/.test(t)) {
      // Numbered list item ("1. " / "2) ")
      flushPara();
      if (list.length && !list.ordered) flushList();
      list.ordered = true;
      list.push(t.replace(/^\d+[.)]\s+/, ""));
    } else if (/^[-*]\s+/.test(t)) {
      // Bullet list item ("- " / "* ")
      flushPara();
      if (list.length && list.ordered) flushList();
      list.push(t.replace(/^[-*]\s+/, ""));
    } else if (t === "") {
      flushPara(); flushList();
    } else {
      flushList(); para.push(t);
    }
  }
  flushPara();
  flushList();

  return (
    <div className={className} style={style}>
      {blocks.map((b, i) =>
        b.type === "ul" || b.type === "ol" ? (
          React.createElement(
            b.type,
            { key: i, style: { listStyle: b.type === "ol" ? "decimal" : "disc", paddingLeft: "1.25rem", margin: "0.4rem 0" } },
            b.items.map((it, j) => (
              <li key={j} style={{ marginBottom: 2 }}>{renderInline(it, `${i}-${j}-`)}</li>
            ))
          )
        ) : (
          <p key={i} style={{ margin: "0.4rem 0" }}>
            {b.lines.map((ln, j) => (
              <React.Fragment key={j}>
                {renderInline(ln, `${i}-${j}-`)}
                {j < b.lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        )
      )}
    </div>
  );
}

// Flatten markdown to plain text — for truncated card blurbs / list previews,
// so raw "**" / "- " markers never leak into a one-line summary.
export function stripMarkdown(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^[\s]*(?:[-*]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
