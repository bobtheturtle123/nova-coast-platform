"use client";

import { useState, useRef, useEffect } from "react";
import { auth } from "@/lib/firebase";

const SUGGESTED_QUESTIONS = [
  "How do I assign services to a photographer?",
  "How does the agent portal work?",
  "How do I create a manual booking?",
  "How does gallery delivery work?",
  "How do I set up service areas?",
];

export default function AiChatButton() {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your KyoriaOS assistant. Ask me anything about the platform - features, how-tos, or troubleshooting." }
  ]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/dashboard/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
          style={{ maxHeight: "calc(100vh - 120px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-[#3486cf] rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">KyoriaOS Assistant</p>
                <p className="text-[10px] text-white/60">Powered by AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMessages([{ role: "assistant", content: "Hi! I'm your KyoriaOS assistant. Ask me anything about the platform - features, how-tos, or troubleshooting." }])}
                className="text-white/50 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                title="New conversation">
                New chat
              </button>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-xl leading-none">×</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#3486cf] text-white rounded-br-sm"
                    : "bg-gray-100 text-[#0F172A] rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            {/* Suggested questions (only show at start) */}
            {messages.length === 1 && !loading && (
              <div className="space-y-1.5 mt-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Suggested questions</p>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="w-full text-left text-xs px-3 py-2 border border-gray-200 rounded-lg hover:border-[#3486cf]/30 hover:bg-[#3486cf]/5 transition-colors text-gray-600">
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything…"
                disabled={loading}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#3486cf]/40 transition-colors disabled:opacity-50"
              />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="bg-[#3486cf] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#3486cf]/90 transition-colors disabled:opacity-40">
                ↑
              </button>
            </div>
            <p className="text-[10px] text-gray-300 mt-1.5 text-center">
              Can&apos;t find an answer? Email <a href="mailto:contact@kyoriaos.com" className="underline">contact@kyoriaos.com</a>
            </p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 bg-[#3486cf] text-white rounded-full shadow-lg hover:bg-[#3486cf]/90 transition-all flex items-center justify-center"
        title="KyoriaOS Assistant"
      >
        {open ? (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </>
  );
}
