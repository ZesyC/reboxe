"use client";

import { ApiClientError } from "@reboxe/api-client";
import type { PublicListing, ShoppingSuggestions } from "@reboxe/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserApiClient } from "../../platform/api/browser";
import { formatPrice } from "../commerce-data";
import { ProductVisual } from "../commerce-ui";
import { ShoppingCheckout } from "./shopping-checkout";

const api = createBrowserApiClient();
const primaryButton = "inline-flex min-h-12 items-center justify-center bg-[var(--accent-strong)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--ink)] disabled:opacity-50";
const maxMessageLength = 500;

type VoiceCapture = {
  controller: AbortController;
  stop?: () => void;
};

const audioTypes = ["audio/webm", "audio/ogg", "audio/mp4"];
const voiceErrors: Partial<Record<string, string>> = {
  NotAllowedError: "Bạn hãy cho phép dùng micro trong trình duyệt hoặc nhập bằng bàn phím.",
  NotFoundError: "Không tìm thấy micro. Bạn có thể nhập bằng bàn phím."
};

export function ShoppingChat({ open, initialListing, unavailable }: {
  open: boolean;
  initialListing: PublicListing | undefined;
  unavailable: boolean;
}) {
  const [selected, setSelected] = useState(initialListing);
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<ShoppingSuggestions>();
  const [error, setError] = useState(unavailable ? "Kiện bạn chọn hiện không còn bán. Bạn có thể tìm món khác bên dưới." : "");
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<"starting" | "listening" | "transcribing">();
  const speech = useRef<VoiceCapture>(null);
  const searching = useRef(false);
  const conversation = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversation.current) conversation.current.scrollTop = 0;
  }, [busy, selected, suggestions]);

  useEffect(() => {
    if (!open || selected) return;
    return () => {
      const capture = speech.current;
      if (!capture) return;
      speech.current = null;
      capture.controller.abort();
      setVoiceState(undefined);
    };
  }, [open, selected]);

  async function toggleVoiceInput() {
    if (speech.current) {
      speech.current.stop?.();
      return;
    }
    const mimeType = typeof MediaRecorder !== "undefined" && audioTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (!navigator.mediaDevices?.getUserMedia || !mimeType) {
      setError("Trình duyệt này chưa hỗ trợ nhập bằng giọng nói. Bạn có thể nhập bằng bàn phím.");
      return;
    }

    const capture: VoiceCapture = { controller: new AbortController() };
    const { signal } = capture.controller;
    speech.current = capture;
    setError("");
    setVoiceState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let audio: Blob;
      let timeout: number | undefined;
      try {
        if (signal.aborted) return;
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 });
        audio = await new Promise<Blob>((resolve, reject) => {
          const chunks: Blob[] = [];
          const stop = () => {
            if (recorder.state === "inactive") return;
            if (!signal.aborted) setVoiceState("transcribing");
            recorder.stop();
          };
          capture.stop = stop;
          recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
          recorder.onerror = () => reject(new Error("Microphone recording failed"));
          recorder.start();
          signal.addEventListener("abort", stop, { once: true });
          timeout = window.setTimeout(stop, 30_000);
          setVoiceState("listening");
        });
      } finally {
        window.clearTimeout(timeout);
        if (capture.stop) signal.removeEventListener("abort", capture.stop);
        delete capture.stop;
        stream.getTracks().forEach(track => track.stop());
      }
      if (signal.aborted) return;

      setVoiceState("transcribing");
      const text = audio.size ? (await api.transcribeShoppingAudio(audio, signal)).text : "";
      if (signal.aborted) return;
      if (text) {
        setInput(draft => [draft.trim(), text].filter(Boolean).join(" ").slice(0, maxMessageLength));
      } else {
        setError("Mình chưa nghe rõ. Bạn bấm Nói để thử lại nhé.");
      }
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof ApiClientError && error.status === 429
        ? "Bạn đã dùng micro nhiều lần. Vui lòng chờ một chút rồi thử lại."
        : error instanceof DOMException ? voiceErrors[error.name] : undefined;
      setError(message ?? "Chưa thể nhận diện giọng nói. Bạn có thể thử lại hoặc gõ tin nhắn.");
    } finally {
      if (speech.current === capture) {
        speech.current = null;
        setVoiceState(undefined);
      }
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || searching.current || speech.current) return;
    searching.current = true;
    setBusy(true);
    setError("");
    const next = [...messages, message].slice(-8);
    try {
      setSuggestions(await api.suggestShoppingListings({ messages: next }));
      setMessages(next);
      setInput("");
    } catch (error) {
      setError(error instanceof ApiClientError && error.status === 429
        ? "Bạn đã gửi nhiều tin nhắn. Vui lòng chờ một chút rồi gửi lại."
        : "Trợ lý đang gặp lỗi khi tìm hàng. Vui lòng bấm Gửi để thử lại.");
    } finally {
      setBusy(false);
      searching.current = false;
    }
  }

  const reply = !suggestions ? "Chào bạn! Bạn đang muốn mua món gì?"
    : suggestions.needsProductDetails ? "Bạn muốn tìm món gì? Bạn có thể nói thêm tên món, công dụng hoặc khoảng giá."
    : suggestions.listings.length === 0 ? "Mình chưa tìm được sản phẩm phù hợp. Bạn có thể thử tên gọi khác hoặc đổi khoảng giá."
    : `Mình tìm được ${suggestions.listings.length} sản phẩm phù hợp.`;

  return (
    <section aria-label="Cuộc trò chuyện mua hàng" className="flex min-h-0 flex-1 flex-col text-lg">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" ref={conversation}>
        {selected ? (
          <ShoppingCheckout listing={selected} onBack={(purchased) => {
            if (purchased) {
              setSuggestions(undefined);
              setMessages([]);
              setInput("");
            }
            setSelected(undefined);
          }} />
        ) : (
          <div className="grid gap-4">
            <div aria-live="polite" className="grid gap-3">
              {messages.at(-1) && <p className="max-w-[90%] justify-self-end break-words rounded-xl rounded-br-sm bg-[var(--ink)] px-4 py-3 text-xl text-white"><span className="sr-only">Bạn: </span>{messages.at(-1)}</p>}
              <p className="max-w-[90%] justify-self-start rounded-xl rounded-bl-sm border border-[var(--line)] bg-white px-4 py-3 text-xl leading-relaxed"><span className="sr-only">Trợ lý: </span>{busy ? "Mình đang tìm hàng phù hợp…" : reply}</p>
            </div>
            {suggestions && suggestions.listings.length > 0 && !busy && (
              <ul aria-label="Sản phẩm được gợi ý" className="grid gap-3">
                {suggestions.listings.map((listing) => (
                  <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-xl border border-[var(--line)] bg-white p-3" key={listing.id}>
                    <ProductVisual className="size-16 bg-[var(--accent-soft)]" label={listing.images[0]?.url ? listing.title : ""} src={listing.images[0]?.url ?? undefined} />
                    <div className="min-w-0">
                      <Link className="break-words text-xl font-semibold underline decoration-[var(--line-strong)] underline-offset-2 hover:text-[var(--accent-strong)]" href={`/listings/${listing.id}`} target="_blank">{listing.title}<span className="sr-only"> (mở tab mới)</span></Link>
                      {listing.package && <p className="text-base text-[var(--muted)]">Kiện chưa mở kiểm tra</p>}
                      <p className="mt-1 text-xl font-bold text-[var(--accent-strong)]">{formatPrice(listing.price)}</p>
                    </div>
                    {listing.package && listing.availableQuantity === 1
                      ? <button aria-label={`Mua ${listing.title}`} className={`${primaryButton} col-span-2 justify-self-end rounded-lg`} onClick={() => setSelected(listing)} type="button">Mua</button>
                      : <p className="col-start-2 text-sm text-[var(--muted)]">Chưa thể đặt qua chat</p>}
                  </li>
                ))}
              </ul>
            )}
            {messages.length > 0 && !busy && (
              <button className="min-h-11 justify-self-start text-left font-medium text-[var(--accent-strong)] underline underline-offset-2 disabled:opacity-50" disabled={!!voiceState} onClick={() => {
                setMessages([]);
                setSuggestions(undefined);
                setInput("");
                setError("");
              }} type="button">Bắt đầu tìm món khác</button>
            )}
          </div>
        )}
      </div>
      {!selected && (
        <form className="grid shrink-0 gap-2 border-t border-[var(--line)] bg-white p-3" onSubmit={(event) => void send(event)}>
          {error && <p className="font-medium text-[var(--danger)]" role="alert">{error}</p>}
          {voiceState && <p className="font-medium text-[var(--accent-strong)]" role="status">
            {voiceState === "starting" ? "Nếu được hỏi, bạn hãy cho phép dùng micro."
              : voiceState === "listening" ? "Đang nghe… Bấm Dừng khi bạn nói xong."
              : "Đang chuyển lời nói thành chữ…"}
          </p>}
          <label className="sr-only" htmlFor="shopping-message">Bạn muốn mua gì?</label>
          <textarea
            className="min-h-12 w-full resize-none rounded-xl border border-[var(--line-strong)] px-3 py-2 text-xl leading-snug"
            disabled={busy} id="shopping-message" maxLength={maxMessageLength} onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
            placeholder="Nhập món cần mua…" required rows={2} value={input}
          />
          <div className="flex items-center justify-between gap-2">
            <button aria-label={voiceState === "listening" ? "Dừng nhập bằng giọng nói" : "Nói để nhập tin nhắn"}
              className="min-h-12 min-w-14 shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--accent-soft)] px-2 font-semibold text-[var(--accent-strong)] hover:border-[var(--accent-strong)] disabled:opacity-50"
              disabled={busy || voiceState === "starting" || voiceState === "transcribing"}
              onClick={() => void toggleVoiceInput()} type="button">{voiceState === "listening" ? "Dừng" : "Nói"}</button>
            <button className={`${primaryButton} shrink-0 rounded-full`} disabled={busy || !!voiceState || !input.trim()} type="submit">Gửi</button>
          </div>
        </form>
      )}
    </section>
  );
}
