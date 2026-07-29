"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK = [
  "Show me evening wear",
  "What are your delivery fees?",
  "Book a fitting appointment",
  "Track my order",
];

function renderContent(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+|\/product\/[a-z0-9-]+|\/[a-z-]{3,})/gi);
  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline break-all"
        >
          {part.includes("wa.me") ? "Open WhatsApp" : part}
        </a>
      );
    }
    if (/^\/[a-z0-9-]+/i.test(part)) {
      return (
        <a key={index} href={part} className="text-accent underline">
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function ConciergePanel({
  greeting,
  whatsappUrl,
  whatsappNumber,
  onClose,
}: {
  greeting: string;
  whatsappUrl: string;
  whatsappNumber: string;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: greeting }]);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setDraft("");
    setPending(true);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1) }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            data.reply ??
            `Forgive me, something interrupted us. Our team is always available on WhatsApp at ${whatsappNumber}.`,
        },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Forgive me, I could not reach our system just now. You are always welcome on WhatsApp at ${whatsappNumber}.`,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="OSSZ Concierge"
      className="fixed bottom-24 right-2 z-[70] flex h-[70vh] max-h-[560px] w-[calc(100vw-1rem)] max-w-sm flex-col overflow-hidden rounded-sm border border-line bg-paper shadow-2xl rise md:right-6"
    >
      <header className="flex items-start justify-between gap-2 border-b border-line bg-ink px-4 py-3 text-white">
        <div>
          <p className="display text-lg leading-tight">The OSSZ Concierge</p>
          <p className="text-[0.7rem] tracking-[0.14em] uppercase text-white/70">
            Here for you, around the clock
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-white/70 hover:text-white">
          ×
        </button>
      </header>

      <p className="border-b border-line bg-canvas px-4 py-2 text-[0.65rem] leading-relaxed text-muted">
        Conversations are kept so we may improve our service. Please do not share card details here.
      </p>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`max-w-[85%] whitespace-pre-wrap rounded-sm px-3 py-2 text-sm leading-relaxed ${
              msg.role === "user" ? "ml-auto bg-ink text-white" : "bg-accent-soft/60 text-ink-soft"
            }`}
          >
            {renderContent(msg.content)}
          </div>
        ))}
        {pending ? <p className="text-xs italic text-muted">The concierge is checking for you…</p> : null}
      </div>

      {messages.length <= 2 ? (
        <div className="flex flex-wrap gap-2 border-t border-line px-3 py-2">
          {QUICK.map((q) => (
            <button key={q} className="chip" onClick={() => send(q)} type="button">
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-center gap-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label className="sr-only" htmlFor="concierge-input">Message the concierge</label>
        <input
          id="concierge-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about a piece, a size, an order…"
          className="field"
          autoComplete="off"
        />
        <button className="btn btn-primary btn-sm" disabled={pending || !draft.trim()}>Send</button>
      </form>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="border-t border-line bg-canvas px-4 py-3 text-center text-[0.7rem] tracking-[0.16em] uppercase text-ink-soft hover:text-accent"
      >
        Speak with a person on WhatsApp
      </a>
    </section>
  );
}
