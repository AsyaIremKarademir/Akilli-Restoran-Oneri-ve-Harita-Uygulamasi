"use client";

import { Bot, Loader2, MessageCircle, SendHorizonal, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useT } from "@/i18n";
import { selectChatCandidates } from "@/lib/chat";
import { CATEGORY_EMOJI } from "@/lib/cuisines";
import { formatDistance } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { useUserStore } from "@/store/user";

export function ChatWidget() {
  const { t, dict, locale } = useT();
  const open = useUiStore((s) => s.chatOpen);
  const setOpen = useUiStore((s) => s.setChatOpen);
  const select = useUiStore((s) => s.select);
  const setTab = useUiStore((s) => s.setTab);
  const preferences = useUserStore((s) => s.preferences);
  const { recommendations, nearby } = useRecommendations();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const allById = new Map(nearby.map((n) => [n.place.id, n]));

  async function send(text) {
    const content = text.trim();
    if (!content || pending) return;
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");

    if (nearby.length === 0) {
      setMessages([...history, { role: "assistant", content: t("chat.noPlaces") }]);
      return;
    }

    const unscored = nearby.map((n) => ({ ...n, score: 50 }));
    const source = recommendations.length ? recommendations : unscored;
    const previousUserTexts = messages.filter((m) => m.role === "user").map((m) => m.content);
    const pool = selectChatCandidates(source, content, previousUserTexts, unscored);

    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          messages: history.map(({ role, content }) => ({ role, content })),
          places: pool,
          preferences: {
            cuisines: preferences.cuisines,
            maxDistance: preferences.maxDistance,
            priceRange: preferences.priceRange,
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages([...history, { role: "assistant", content: data.reply, placeIds: data.placeIds, mode: data.mode }]);
    } catch {
      setMessages([...history, { role: "assistant", content: t("chat.error") }]);
    } finally {
      setPending(false);
    }
  }

  const showPlace = (id) => {
    setTab("all");
    select(id, "list");
  };

  if (!open) {
    return (
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 h-12 rounded-full px-5 shadow-lg"
        aria-label={t("chat.open")}
      >
        <MessageCircle className="size-5" />
        <span className="hidden sm:inline">{t("chat.title")}</span>
      </Button>
    );
  }

  return (
    <div className="fixed right-2 bottom-2 left-2 z-40 flex h-[min(560px,75dvh)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:right-4 sm:bottom-4 sm:left-auto sm:w-[380px]">
      <div className="flex items-center gap-2 border-b bg-primary px-3 py-2.5 text-primary-foreground">
        <Bot className="size-5" />
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold">{t("chat.title")}</p>
          <p className="text-xs opacity-80">{t("chat.subtitle")}</p>
        </div>
        {messages.length > 0 && (
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            onClick={() => setMessages([])}
            aria-label={t("chat.clear")}
            title={t("chat.clear")}
          >
            <Trash2 />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
          onClick={() => setOpen(false)}
          aria-label={t("chat.close")}
        >
          <X />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        <Bubble role="assistant">{t("chat.greeting")}</Bubble>
        {messages.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <Bubble role={m.role}>{m.content}</Bubble>
            {m.placeIds && m.placeIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {m.placeIds.map((id) => {
                  const entry = allById.get(id);
                  if (!entry) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => showPlace(id)}
                      className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:bg-accent"
                    >
                      {CATEGORY_EMOJI[entry.place.categories[0] ?? "other"]} {entry.place.name}
                      <span className="text-muted-foreground">· {formatDistance(entry.distance, locale)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {m.mode === "rules" && <p className="pl-1 text-[11px] text-muted-foreground">{t("chat.offline")}</p>}
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("chat.thinking")}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {dict.chat.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          maxLength={500}
          disabled={pending}
          autoFocus
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label={t("chat.send")}>
          <SendHorizonal />
        </Button>
      </form>
    </div>
  );
}

function Bubble({ role, children }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-line",
          role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
        )}
      >
        {children}
      </div>
    </div>
  );
}
