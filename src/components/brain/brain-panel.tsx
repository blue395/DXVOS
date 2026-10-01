"use client";

// The floating DXV Brain: ask anything from any page. It knows which deal page you're
// on, looks things up in DXV OS (read-only) and on the web, and keeps your chats
// (private to you). Replies are written by a background worker; while one is being
// written this panel checks for new text about once a second.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { archiveBrainChat, askBrain } from "@/app/(app)/brain-actions";
import { isAnswering, type BrainChat, type BrainChatSummary } from "@/lib/brain/view";
import { dealIdFromPath, MAX_QUESTION_CHARS } from "@/lib/brain/page";
import { actionErrorMessage } from "@/lib/stale-version";
import { Spinner } from "@/components/ui";
import { Markdown } from "./markdown";

const POLL_MS = 1000;
const STORE_KEY = "dxv-brain"; // this browser only: whether it's open and which chat

const DEAL_PROMPTS = ["Summarise where this deal stands and what's next", "What are the biggest risks, and what should DD focus on?", "What should we ask the founder next?"];
const GENERAL_PROMPTS = ["What's in due diligence right now, and what's outstanding?", "What moved in the pipeline this week?", "Which of our lessons apply to healthtech deals?"];

function load(): { open: boolean; chatId: string | null } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    return { open: !!v.open, chatId: typeof v.chatId === "string" ? v.chatId : null };
  } catch {
    return { open: false, chatId: null };
  }
}
function store(v: { open: boolean; chatId: string | null }) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    // private window or blocked storage: the panel still works, it just won't remember
  }
}

export function BrainPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [chatId, setChatId] = useState<string | null>(null);
  const [chat, setChat] = useState<BrainChat | null>(null);
  const [chats, setChats] = useState<BrainChatSummary[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealName, setDealName] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const onDeal = !!dealIdFromPath(pathname);

  // Restore this browser's last state after hydration, and only then start saving it.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const s = load();
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only storage once on mount */
    setOpen(s.open);
    setChatId(s.chatId);
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (restored) store({ open, chatId });
  }, [restored, open, chatId]);

  // The deal's name, for the "asking about" chip (read from the deal page's heading).
  useEffect(() => {
    const read = () => setDealName(onDeal ? (document.querySelector("main h1")?.textContent?.trim() ?? null) : null);
    read();
    const t = setTimeout(read, 800); // after the page (or its skeleton) has rendered
    return () => clearTimeout(t);
  }, [pathname, onDeal]);

  /** Returns false if the chat couldn't be loaded. */
  const fetchChat = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/brain/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setChatId(null);
        setChat(null);
        return false;
      }
      if (!res.ok) return false;
      setChat((await res.json()) as BrainChat);
      return true;
    } catch {
      return false; // offline for a moment: while a reply is being written, the next check tries again
    }
  }, []);

  // Load the open chat, and check again every second while a reply is being written.
  const answering = !!chat?.messages.some(isAnswering);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open || !chatId) return;
    const first = !chat || chat.id !== chatId;
    if (!first && !answering) return;
    const t = setTimeout(async () => {
      const ok = await fetchChat(chatId);
      if (ok || !first) setTick((n) => n + 1); // keep checking while answering, even through a blip
    }, first ? 0 : POLL_MS);
    return () => clearTimeout(t);
  }, [open, chatId, chat, answering, fetchChat, tick]);

  // Keep the newest text in view.
  const lastText = chat?.messages[chat.messages.length - 1]?.text.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat?.messages.length, lastText, open, view]);

  // Ctrl/Cmd + J opens and closes the Brain from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open && view === "chat") inputRef.current?.focus();
  }, [open, view]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || sending || answering) return;
    setSending(true);
    setError(null);
    try {
      const res = await askBrain({ conversationId: chatId, question: q, pagePath: pathname });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDraft("");
      if (res.conversationId !== chatId) setChat(null);
      setChatId(res.conversationId);
      await fetchChat(res.conversationId);
    } catch (e) {
      setError(actionErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    setChatId(null);
    setChat(null);
    setError(null);
    setView("chat");
    inputRef.current?.focus();
  }

  async function openHistory() {
    setView("history");
    setChats(null);
    try {
      const res = await fetch("/api/brain", { cache: "no-store" });
      if (res.ok) setChats(((await res.json()) as { chats: BrainChatSummary[] }).chats);
    } catch {
      setChats([]);
    }
  }

  async function archive(id: string) {
    setChats((cs) => cs?.filter((c) => c.id !== id) ?? null);
    if (id === chatId) newChat();
    try {
      await archiveBrainChat(id);
    } catch (e) {
      setError(actionErrorMessage(e));
    }
  }

  const lastQuestion = [...(chat?.messages ?? [])].reverse().find((m) => m.role === "USER")?.text;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ask the DXV Brain (Ctrl+J)"
        aria-label="Ask the DXV Brain"
        className="fixed right-4 bottom-4 z-[60] flex items-center gap-2 rounded-full bg-dxv-green p-2.5 text-sm font-semibold text-white shadow-lg ring-2 ring-dxv-yellow/70 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 sm:py-2.5 sm:pr-4 sm:pl-3 print:hidden"
      >
        <BrainIcon />
        {/* Phones: just the round icon, so it covers less of the page. */}
        <span className="hidden sm:inline">DXV Brain</span>
        {answering && <Spinner className="h-3 w-3 text-dxv-yellow" />}
      </button>
    );
  }

  return (
    <section
      aria-label="DXV Brain"
      className="fixed right-4 bottom-4 z-[60] flex h-[min(42rem,calc(100vh-2rem))] w-[27rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl print:hidden"
    >
      <header className="flex items-center gap-2 bg-dxv-green px-3 py-2.5 text-white">
        <BrainIcon />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm leading-tight font-semibold">DXV Brain</h2>
          <p className="truncate text-[11px] text-white/65">{view === "history" ? "Your chats (only you can see them)" : chat?.title ?? "DXV OS + Claude + the web"}</p>
        </div>
        <HeaderButton label="Your chats" onClick={() => (view === "history" ? setView("chat") : void openHistory())} active={view === "history"}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5h14M3 10h14M3 15h9" strokeLinecap="round" /></svg>
        </HeaderButton>
        <HeaderButton label="New chat" onClick={newChat}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>
        </HeaderButton>
        <HeaderButton label="Close (Ctrl+J)" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
        </HeaderButton>
      </header>

      {view === "history" ? (
        <div className="flex-1 overflow-y-auto p-2">
          {chats === null && (
            <p className="flex items-center gap-2 p-3 text-sm text-black/55">
              <Spinner className="h-3 w-3 text-dxv-green" /> Loading your chats…
            </p>
          )}
          {chats?.length === 0 && <p className="p-3 text-sm text-black/55">No chats yet.</p>}
          <ul className="space-y-1">
            {chats?.map((c) => (
              <li key={c.id} className="group flex items-center gap-1 rounded-lg hover:bg-dxv-green/5">
                <button
                  type="button"
                  className="min-w-0 flex-1 px-3 py-2 text-left"
                  onClick={() => {
                    setChat(null);
                    setChatId(c.id);
                    setView("chat");
                  }}
                >
                  <span className={`block truncate text-sm ${c.id === chatId ? "font-semibold text-dxv-green" : "text-black/85"}`}>{c.title}</span>
                  <span className="block text-[11px] text-black/45">{new Date(c.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void archive(c.id)}
                  className="mr-1 rounded px-2 py-1 text-xs text-black/40 opacity-0 transition group-hover:opacity-100 hover:bg-black/5 hover:text-black focus:opacity-100"
                  title="Archive this chat (kept, hidden from the list)"
                >
                  Archive
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm leading-relaxed">
            {!chat && (
              <div className="space-y-3">
                <p className="text-black/70">
                  Ask about any deal, the pipeline, DXV&apos;s criteria and lessons, or the wider market. The Brain reads DXV OS (it never changes anything) and searches the web when it helps, citing sources.
                </p>
                <div className="space-y-1.5">
                  {(onDeal ? DEAL_PROMPTS : GENERAL_PROMPTS).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void send(p)}
                      disabled={sending}
                      className="block w-full rounded-lg border border-dxv-green/20 bg-dxv-green/[0.03] px-3 py-2 text-left text-[13px] text-dxv-green transition hover:border-dxv-green/50 hover:bg-dxv-yellow/20 disabled:opacity-60"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chat?.messages.map((m) =>
              m.role === "USER" ? (
                <div key={m.id} className="ml-8 rounded-lg rounded-br-sm bg-dxv-green/10 px-3 py-2 whitespace-pre-wrap text-black/85">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="mr-2 space-y-2">
                  {m.text && <Markdown text={m.text} />}
                  {isAnswering(m) && (
                    <p className="flex items-center gap-2 text-xs text-dxv-green" aria-live="polite">
                      <Spinner className="h-3 w-3" />
                      {m.activity ?? (m.text ? "Writing" : "Thinking")}…
                    </p>
                  )}
                  {m.status === "FAILED" && (
                    <div role="alert" className="space-y-1.5 rounded-md border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2 text-xs">
                      <p>{m.error ?? "The Brain couldn't answer."}</p>
                      {lastQuestion && (
                        <button type="button" onClick={() => void send(lastQuestion)} disabled={sending} className="font-semibold text-dxv-green hover:underline">
                          Try again
                        </button>
                      )}
                    </div>
                  )}
                  {m.sources.length > 0 && (
                    <div className="border-t border-black/5 pt-1.5">
                      <p className="text-[10px] font-semibold tracking-wide text-black/45 uppercase">Web sources</p>
                      <ul className="mt-0.5 space-y-0.5 text-xs">
                        {m.sources.map((s) => (
                          <li key={s.url} className="truncate">
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-dxv-green underline decoration-dxv-green/30 underline-offset-2 hover:decoration-dxv-green" title={s.url}>
                              {s.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>

          <form
            className="border-t border-black/10 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            {onDeal && (
              <p className="mb-1.5 truncate px-1 text-[11px] text-black/55" title="The Brain knows which deal page you're on">
                Asking from <span className="font-semibold text-dxv-green">{dealName ?? "this deal"}</span>
              </p>
            )}
            {error && (
              <p role="alert" className="mb-1.5 rounded bg-dxv-yellow/30 px-2 py-1 text-xs">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={Math.min(6, Math.max(1, draft.split("\n").length))}
                maxLength={MAX_QUESTION_CHARS}
                placeholder={answering ? "The Brain is answering…" : onDeal ? "Ask about this deal, or anything else…" : "Ask the DXV Brain…"}
                aria-label="Your question"
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-dxv-green focus:ring-2 focus:ring-dxv-green/20"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending || answering}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-dxv-green px-3 text-sm font-semibold text-white transition hover:bg-dxv-green/90 active:scale-95 disabled:opacity-40"
              >
                {sending ? <Spinner className="h-3.5 w-3.5" /> : null}
                {sending ? "Sending" : "Ask"}
              </button>
            </div>
            <p className="mt-1 px-1 text-[10px] text-black/40">AI suggests, you decide. Enter to send, Shift+Enter for a new line.</p>
          </form>
        </>
      )}
    </section>
  );
}

function HeaderButton({ label, onClick, active = false, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 transition hover:bg-white/15 active:scale-95 ${active ? "bg-white/20 text-dxv-yellow" : "text-white/85"}`}
    >
      {children}
    </button>
  );
}

function BrainIcon() {
  return (
    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dxv-yellow text-dxv-green">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M10 1.5l1.9 5.1 5.1 1.9-5.1 1.9L10 15.5l-1.9-5.1L3 8.5l5.1-1.9L10 1.5zM15.5 13l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
      </svg>
    </span>
  );
}
