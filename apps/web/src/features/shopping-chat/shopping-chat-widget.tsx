"use client";

import type { PublicListing } from "@reboxe/shared";
import { useEffect, useRef, useState } from "react";
import { ShoppingChat } from "./shopping-chat";

export function ShoppingChatWidget({ initialOpen, initialListing, unavailable }: {
  initialOpen: boolean;
  initialListing: PublicListing | undefined;
  unavailable: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [showPrompt, setShowPrompt] = useState(false);
  const promptDismissed = useRef(initialOpen);
  const opener = useRef<HTMLButtonElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) title.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (open || promptDismissed.current) return;
    const timer = window.setTimeout(() => setShowPrompt(true), 900);
    return () => window.clearTimeout(timer);
  }, [open]);

  function dismissPrompt() {
    promptDismissed.current = true;
    setShowPrompt(false);
  }

  function openChat(from: HTMLButtonElement | null) {
    dismissPrompt();
    opener.current = from;
    if (open) title.current?.focus({ preventScroll: true });
    else setOpen(true);
  }

  function closeChat() {
    setOpen(false);
    const button = opener.current ?? launcher.current;
    button?.focus({ preventScroll: true });
  }

  return (
    <>
      <section className="bg-[var(--paper)] px-4 pt-5 sm:px-6">
        <div className="reboxe-container flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 sm:px-6">
          <div>
            <h2 className="text-xl font-bold">Mua hàng qua chat</h2>
            <p className="mt-1 text-base text-[var(--muted)]">Nói món bạn cần, trợ lý sẽ tìm hàng phù hợp và hướng dẫn đặt mua.</p>
          </div>
          <button aria-controls="shopping-chat-panel" aria-expanded={open}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--accent-strong)] px-5 py-2.5 text-base font-semibold text-white hover:bg-[var(--ink)]"
            onClick={(event) => openChat(event.currentTarget)} type="button">Mở ô chat mua hàng</button>
        </div>
      </section>

      <section aria-labelledby="shopping-chat-title"
        className="fixed right-3 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-[45] h-[min(38rem,calc(100dvh_-_5.5rem_-_env(safe-area-inset-bottom)))] w-[min(27rem,calc(100%_-_1.5rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-xl sm:right-5"
        hidden={!open} id="shopping-chat-panel" onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          closeChat();
        }} role="dialog">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 bg-[var(--accent-strong)] px-4 py-2 text-white">
            <h2 className="text-xl font-bold focus-visible:outline-white" id="shopping-chat-title" ref={title} tabIndex={-1}>Trợ lý mua hàng</h2>
            <button aria-label="Đóng ô chat" className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-white/15 focus-visible:outline-white" onClick={closeChat} type="button">
              <span aria-hidden="true" className="text-3xl leading-none">×</span>
            </button>
          </div>
          <ShoppingChat open={open} initialListing={initialListing} unavailable={unavailable} />
        </div>
      </section>

      <div className="fixed right-3 bottom-[calc(1rem_+_env(safe-area-inset-bottom))] z-[45] sm:right-5">
        {showPrompt && !open && (
          <aside aria-label="Lời mời mua hàng qua chat"
            className="absolute right-0 bottom-full mb-3 grid w-[min(17rem,calc(100vw_-_1.5rem))] origin-bottom-right grid-cols-[1fr_auto] gap-1 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-lg sm:right-full sm:bottom-0 sm:mr-3 sm:mb-0 sm:w-72 motion-safe:transition-[opacity,scale,translate] motion-safe:duration-300 motion-safe:ease-out motion-safe:starting:translate-y-2 motion-safe:starting:scale-95 motion-safe:starting:opacity-0">
            <button aria-controls="shopping-chat-panel"
              className="grid gap-1 rounded-lg px-3 py-2 text-left hover:bg-[var(--accent-soft)]"
              onClick={() => openChat(launcher.current)} type="button">
              <span className="text-xl font-bold text-[var(--accent-strong)]">Bạn muốn mua gì?</span>
              <span className="text-lg leading-snug text-[var(--ink)]">Mình giúp bạn tìm món cần mua.</span>
            </button>
            <button aria-label="Tắt lời mời mua hàng" className="grid size-11 place-items-center rounded-lg text-[var(--ink)] hover:bg-[var(--accent-soft)]"
              onClick={() => {
                dismissPrompt();
                launcher.current?.focus({ preventScroll: true });
              }} type="button">
              <span aria-hidden="true" className="text-3xl leading-none">×</span>
            </button>
            <span aria-hidden="true" className="pointer-events-none absolute top-full right-16 -mt-1.5 size-3 rotate-45 border-r border-b border-[var(--line)] bg-white sm:top-auto sm:right-auto sm:bottom-[17px] sm:left-full sm:mt-0 sm:-ml-1.5 sm:border-t sm:border-b-0" />
          </aside>
        )}
        <button aria-controls="shopping-chat-panel" aria-expanded={open}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-2 text-base font-semibold text-white shadow-lg hover:bg-[var(--ink)]"
          onClick={(event) => open ? closeChat() : openChat(event.currentTarget)} ref={launcher} type="button">
          {open ? "Thu gọn chat" : "Chat mua hàng"}
        </button>
      </div>
    </>
  );
}
