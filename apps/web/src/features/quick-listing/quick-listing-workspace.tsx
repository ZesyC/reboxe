"use client";

import { ApiClientError } from "@reboxe/api-client";
import type { Category } from "@reboxe/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../../platform/api/browser";
import { QuickListingChat } from "./quick-listing-chat";

const api = createBrowserApiClient();

type WorkspaceState =
  | { status: "loading" | "signed-out" | "no-shop" | "error" }
  | { status: "ready"; shopId: string; categories: Category[] };

export function QuickListingWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([api.getMe(), api.listCategories().catch(() => [])]).then(([actor, categories]) => {
      if (!active) return;
      const shop = actor.shops[0];
      setState(shop ? { status: "ready", shopId: shop.id, categories } : { status: "no-shop" });
    }).catch((error: unknown) => {
      if (active) setState({ status: error instanceof ApiClientError && error.status === 401 ? "signed-out" : "error" });
    });
    return () => { active = false; };
  }, [attempt]);

  if (state.status === "ready") return <QuickListingChat categories={state.categories} key={state.shopId} shopId={state.shopId} />;

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-6" aria-busy={state.status === "loading"}>
      <h1 className="text-xl font-bold">Đăng nhanh</h1>
      <div className="mt-2 grid justify-items-start gap-3 text-sm text-[var(--muted)]">
        {state.status === "loading" && <p role="status">Đang mở cuộc trò chuyện…</p>}
        {state.status === "signed-out" && <>
          <p>Đăng nhập để mở cuộc trò chuyện của shop.</p>
          <Link className="font-bold text-[var(--accent-strong)]" href="/login?next=/seller/quick-listing">Đăng nhập</Link>
        </>}
        {state.status === "no-shop" && <>
          <p>Bạn cần có shop để đăng bán.</p>
          <Link className="font-bold text-[var(--accent-strong)]" href="/seller/onboarding">Mở shop</Link>
        </>}
        {state.status === "error" && <>
          <p role="alert">Chưa mở được cuộc trò chuyện.</p>
          <button className="font-bold text-[var(--accent-strong)]" onClick={() => { setState({ status: "loading" }); setAttempt(attempt + 1); }} type="button">Thử lại</button>
        </>}
      </div>
    </section>
  );
}
