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

type SpeechCapture = {
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onaudiostart: () => void;
  onresult: (event: { results: SpeechRecognitionResultList; resultIndex: number }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
};

const noSpeechMessage = "Mình chưa nghe rõ. Bạn bấm Nói để thử lại nhé.";
const voiceErrors: Partial<Record<string, string>> = {
  "not-allowed": "Bạn hãy cho phép dùng micro trong trình duyệt hoặc nhập bằng bàn phím.",
  "service-not-allowed": "Trình duyệt chưa cho phép nhận diện giọng nói. Bạn có thể nhập bằng bàn phím.",
  "audio-capture": "Không tìm thấy micro. Bạn có thể nhập bằng bàn phím.",
  "no-speech": noSpeechMessage,
  network: "Chưa kết nối được dịch vụ nhận diện giọng nói. Bạn có thể thử lại hoặc gõ tin nhắn."
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
  const [voiceState, setVoiceState] = useState<"starting" | "listening" | "stopping">();
  const speech = useRef<SpeechCapture>(null);
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
      capture.abort();
      setVoiceState(undefined);
    };
  }, [open, selected]);

  function toggleVoiceInput() {
    if (speech.current) {
      setVoiceState("stopping");
      speech.current.stop();
      return;
    }
    const browser = window as Window & {
      SpeechRecognition?: new () => SpeechCapture;
      webkitSpeechRecognition?: new () => SpeechCapture;
    };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Trình duyệt này chưa hỗ trợ nhập bằng giọng nói. Bạn có thể nhập bằng bàn phím.");
      return;
    }

    function finish() {
      speech.current = null;
      setVoiceState(undefined);
    }
    try {
      const capture = new Recognition();
      let receivedText = false;
      capture.lang = "vi-VN";
      speech.current = capture;
      setError("");
      setVoiceState("starting");
      capture.onaudiostart = () => {
        if (speech.current === capture) setVoiceState((state) => state === "starting" ? "listening" : state);
      };
      capture.onresult = ({ results, resultIndex }) => {
        if (speech.current !== capture) return;
        const transcript = Array.from(results).slice(resultIndex)
          .filter((result) => result.isFinal).map((result) => result[0]?.transcript.trim()).join(" ").trim();
        if (!transcript) return;
        receivedText = true;
        setInput((draft) => [draft.trim(), transcript].filter(Boolean).join(" ").slice(0, maxMessageLength));
      };
      capture.onerror = ({ error }) => {
        if (speech.current !== capture) return;
        finish();
        if (error !== "aborted") setError(voiceErrors[error] ?? "Chưa thể nhận diện giọng nói. Bạn có thể thử lại hoặc gõ tin nhắn.");
      };
      capture.onend = () => {
        if (speech.current !== capture) return;
        finish();
        if (!receivedText) setError(noSpeechMessage);
      };
      capture.start();
    } catch {
      finish();
      setError("Chưa thể bật micro. Bạn có thể thử lại hoặc gõ tin nhắn.");
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
    : suggestions.listings.length === 0 ? "Mình chưa tìm được kiện phù hợp. Bạn có thể thử tên gọi khác hoặc đổi khoảng giá."
    : `Mình tìm được ${suggestions.listings.length} kiện phù hợp. Bạn có thể xem chi tiết rồi bấm Mua.`;

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
              <ul aria-label="Các kiện được gợi ý" className="grid gap-3">
                {suggestions.listings.map((listing) => (
                  <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-xl border border-[var(--line)] bg-white p-3" key={listing.id}>
                    <ProductVisual className="size-16 bg-[var(--accent-soft)]" label={listing.images[0]?.url ? listing.title : ""} src={listing.images[0]?.url ?? undefined} />
                    <div className="min-w-0">
                      <Link className="break-words text-xl font-semibold underline decoration-[var(--line-strong)] underline-offset-2 hover:text-[var(--accent-strong)]" href={`/listings/${listing.id}`} target="_blank">{listing.title}<span className="sr-only"> (mở tab mới)</span></Link>
                      <p className="text-base text-[var(--muted)]">Kiện chưa mở kiểm tra</p>
                      <p className="mt-1 text-xl font-bold text-[var(--accent-strong)]">{formatPrice(listing.price)}</p>
                    </div>
                    <button aria-label={`Mua ${listing.title}`} className={`${primaryButton} col-span-2 justify-self-end rounded-lg`} onClick={() => setSelected(listing)} type="button">Mua</button>
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
              : voiceState === "listening" ? "Đang nghe… Bạn cứ nói món mình muốn mua."
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
            <button aria-label={voiceState ? "Dừng nhập bằng giọng nói" : "Nói để nhập tin nhắn"}
              className="min-h-12 min-w-14 shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--accent-soft)] px-2 font-semibold text-[var(--accent-strong)] hover:border-[var(--accent-strong)] disabled:opacity-50"
              disabled={busy || voiceState === "stopping"} onClick={toggleVoiceInput} type="button">{voiceState ? "Dừng" : "Nói"}</button>
            <button className={`${primaryButton} shrink-0 rounded-full`} disabled={busy || !!voiceState || !input.trim()} type="submit">Gửi</button>
          </div>
        </form>
      )}
    </section>
  );
}
