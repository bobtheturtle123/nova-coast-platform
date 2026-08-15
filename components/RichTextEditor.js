"use client";
import React, { useEffect, useRef, useCallback } from "react";

// A small WYSIWYG editor for product descriptions. What you type is shown
// formatted (bold is bold, bullets are bullets) — there is no separate preview
// and the studio never sees raw markup. Under the hood we still STORE the same
// lightweight markdown (**bold**, *italic*, "- " bullets, "1. " numbers) that
// <RichText> renders on the booking page, so storage stays plain-text-safe and
// nothing changes downstream.

// ── markdown (stored) → html (shown in the editor) ──────────────────────────
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineToHtml(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"); // bold first
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");            // then italic
  s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  return s;
}
export function markdownToHtml(md) {
  const lines = String(md || "").split(/\r?\n/);
  let html = "";
  let listType = null; // "ul" | "ol"
  const flushList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
  for (const raw of lines) {
    const t = raw.trim();
    const bullet = /^[-*]\s+/.test(t);
    const num    = /^\d+[.)]\s+/.test(t);
    if (bullet || num) {
      const want = bullet ? "ul" : "ol";
      if (listType && listType !== want) flushList();
      if (!listType) { html += `<${want}>`; listType = want; }
      html += `<li>${inlineToHtml(t.replace(/^(?:[-*]|\d+[.)])\s+/, ""))}</li>`;
    } else {
      flushList();
      html += t === "" ? "<div><br></div>" : `<div>${inlineToHtml(t)}</div>`;
    }
  }
  flushList();
  return html;
}

// ── html (edited) → markdown (stored) ───────────────────────────────────────
function inlineMd(node) {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) { out += child.textContent; return; }
    if (child.nodeType !== 1) return;
    const tag = child.tagName.toLowerCase();
    if (tag === "br") { out += "\n"; return; }
    const inner = inlineMd(child);
    const style = (child.getAttribute && child.getAttribute("style")) || "";
    const bold   = tag === "b" || tag === "strong" || /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
    const italic = tag === "i" || tag === "em"     || /font-style\s*:\s*italic/i.test(style);
    if (bold && inner.trim())        out += `**${inner}**`;
    else if (italic && inner.trim()) out += `*${inner}*`;
    else                             out += inner;
  });
  return out;
}
function blockLines(node) {
  if (node.nodeType === 3) { const t = node.textContent; return t ? [t] : []; }
  if (node.nodeType !== 1) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [""];
  if (tag === "ul" || tag === "ol") {
    const lines = [];
    let n = 1;
    node.childNodes.forEach((li) => {
      if (li.nodeType === 1 && li.tagName.toLowerCase() === "li") {
        lines.push((tag === "ol" ? `${n++}. ` : "- ") + inlineMd(li).trim());
      }
    });
    return lines;
  }
  if (tag === "li") return ["- " + inlineMd(node).trim()];
  if (tag === "div" || tag === "p") {
    const hasBlock = Array.from(node.childNodes).some(
      (c) => c.nodeType === 1 && ["div", "p", "ul", "ol"].includes(c.tagName.toLowerCase())
    );
    if (hasBlock) {
      let lines = [];
      node.childNodes.forEach((c) => { lines = lines.concat(blockLines(c)); });
      return lines;
    }
    return [inlineMd(node)];
  }
  return [inlineMd(node)];
}
export function htmlToMarkdown(root) {
  let lines = [];
  root.childNodes.forEach((c) => { lines = lines.concat(blockLines(c)); });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export default function RichTextEditor({ value, onChange, placeholder, className, style }) {
  const ref = useRef(null);
  const lastMd = useRef(value || "");

  // Push external changes (AI fill, import, reset) into the DOM — but never on
  // every keystroke, or the caret would jump to the start.
  useEffect(() => {
    if (!ref.current) return;
    if ((value || "") !== lastMd.current) {
      ref.current.innerHTML = markdownToHtml(value || "");
      lastMd.current = value || "";
    }
  }, [value]);

  // Prefer real <b>/<i> tags over inline styles so serialization stays simple.
  useEffect(() => {
    try { document.execCommand("styleWithCSS", false, false); } catch {}
    if (ref.current) ref.current.innerHTML = markdownToHtml(value || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const md = htmlToMarkdown(ref.current);
    lastMd.current = md;
    onChange?.(md);
  }, [onChange]);

  const cmd = (command) => {
    ref.current?.focus();
    try { document.execCommand("styleWithCSS", false, false); } catch {}
    document.execCommand(command, false, null);
    emit();
  };

  const isEmpty = !(value || "").trim();

  return (
    <div className={className} style={style}>
      <div className="flex items-center gap-1 mb-1.5">
        <button type="button" onClick={() => cmd("bold")} title="Bold"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">B</button>
        <button type="button" onClick={() => cmd("italic")} title="Italic"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-700 italic hover:bg-gray-50">I</button>
        <button type="button" onClick={() => cmd("insertUnorderedList")} title="Bullet list"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">•</button>
        <button type="button" onClick={() => cmd("insertOrderedList")} title="Numbered list"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">1.</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder || ""}
        data-empty={isEmpty ? "true" : "false"}
        className="rte-input input-field w-full resize-y leading-relaxed overflow-y-auto
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
          [&_strong]:font-semibold [&_em]:italic"
        style={{ minHeight: "8.5rem" }}
      />
      <style jsx global>{`
        .rte-input[data-empty="true"]:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .rte-input:focus { outline: none; }
      `}</style>
    </div>
  );
}
