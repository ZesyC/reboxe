import { ApiClientError } from "@reboxe/api-client";
import {
  catalogImageMimeTypes, createListingSchema, maxCatalogImageBytes, maxQuickListingMessageLength, maxQuickListingMessages,
  type Category, type QuickListingSuggestion
} from "@reboxe/shared";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createBrowserApiClient } from "../../platform/api/browser";
import { conditionLabels } from "../commerce-data";
import { coverFromVideo } from "./cover-from-video";

const api = createBrowserApiClient();
const allowedMedia = [...catalogImageMimeTypes, "video/mp4"];
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

type ChatTurn = { message: string; file?: File | undefined; reply?: string | undefined };

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[11px] border border-[var(--line)] bg-white sm:size-9">
        <Image alt="" height={19} src="/reboxe/logo.png" unoptimized width={19} />
      </span>
      <div className="min-w-0 max-w-[calc(100%-2.625rem)] sm:max-w-[85%]">
        <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">Trợ lý REBOXE</p>
        <div className="w-fit rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm leading-6 sm:px-4">{children}</div>
      </div>
    </div>
  );
}

function AttachmentPreview({ file, compact = false }: { file: File; compact?: boolean }) {
  const [source, setSource] = useState<string>();
  const isVideo = file.type === "video/mp4";

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!source || (compact && isVideo)) return <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-strong)]">{isVideo ? "MP4" : "ẢNH"}</span>;
  if (isVideo) return <video aria-label={file.name} className="max-h-52 w-full rounded-xl bg-[var(--ink)] sm:w-[290px]" controls preload="metadata" src={source} />;

  return <Image alt={file.name} className={compact ? "size-10 shrink-0 rounded-lg object-cover" : "max-h-56 w-auto rounded-xl bg-white object-contain object-left"} height={compact ? 40 : 224} src={source} unoptimized width={compact ? 40 : 320} />;
}

function SellerBubble({ turn }: { turn: ChatTurn }) {
  return (
    <div className="ml-auto grid w-fit max-w-[87%] justify-items-end gap-1.5 sm:max-w-[75%]">
      {turn.file && <div className="max-w-full min-w-0 rounded-2xl rounded-br-sm border border-[var(--line-strong)] bg-[var(--accent-soft)] p-1.5">
        <AttachmentPreview file={turn.file} />
        <p className="max-w-60 truncate px-2 pb-0.5 pt-1.5 text-xs text-[var(--accent-strong)]" title={turn.file.name}>{turn.file.name}</p>
      </div>}
      {turn.message && <p className="min-w-0 whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-[var(--accent-strong)] px-4 py-2.5 text-sm leading-6 text-white">{turn.message}</p>}
    </div>
  );
}

export function QuickListingChat({ shopId, categories }: { shopId: string; categories: Category[] }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingTurn, setPendingTurn] = useState<ChatTurn>();
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File>();
  const [suggestion, setSuggestion] = useState<QuickListingSuggestion>();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string>();
  const [listingId, setListingId] = useState<string>();
  const [outcome, setOutcome] = useState<"ACTIVE" | "PENDING_REVIEW">();
  const [requestKey, setRequestKey] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);

  const textTurns = turns.filter(turn => turn.message);
  const turnLimitReached = textTurns.length >= maxQuickListingMessages;
  const file = turns.filter(turn => turn.file).at(-1)?.file;
  const preview = createListingSchema.safeParse(suggestion?.draft);
  const busy = Boolean(pendingTurn || publishing);
  const canSend = !busy && Boolean(selectedFile || (message.trim() && !requestKey && !turnLimitReached));

  useEffect(() => {
    const thread = transcript.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [turns, pendingTurn, error, outcome]);

  useEffect(() => {
    const thread = transcript.current;
    if (!thread) return;
    const observer = new ResizeObserver(() => {
      const distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
      if (distanceFromBottom < 80) thread.scrollTop = thread.scrollHeight;
    });
    observer.observe(thread);
    return () => observer.disconnect();
  }, []);

  function clearSelection() {
    setSelectedFile(undefined);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    const turn = { message: message.trim(), file: selectedFile };
    setError(undefined);

    if (!turn.message) {
      setTurns(current => [...current, turn]);
      clearSelection();
      return;
    }

    setPendingTurn(turn);
    try {
      const past = textTurns.map((item, index) => ({ message: item.message, question: textTurns[index - 1]?.reply }));
      const result = await api.suggestQuickListing(shopId, {
        turns: [...past, { message: turn.message, question: textTurns.at(-1)?.reply }],
        previousDraft: suggestion?.draft
      });
      setTurns(current => [...current, { ...turn, reply: result.question ?? undefined }]);
      setSuggestion(result);
      setMessage("");
      clearSelection();
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.status === 429
        ? "Bạn đã gửi nhiều tin nhắn. Hãy thử lại sau một phút."
        : "Trợ lý chưa đọc được tin nhắn. Bạn có thể bấm Gửi để thử lại.");
    } finally {
      setPendingTurn(undefined);
    }
  }

  async function publish() {
    if (!preview.success || !file || busy || outcome || message.trim() || selectedFile) return;
    setPublishing(true);
    setError(undefined);
    try {
      const cover = file.type === "video/mp4" ? await coverFromVideo(file).catch(() => null) : file;
      if (!cover) { setError("Không đọc được video. Hãy gửi một MP4 khác hoặc gửi ảnh."); return; }
      if (cover.size > maxCatalogImageBytes) { setError("Ảnh bìa cần nhỏ hơn hoặc bằng 5 MiB."); return; }
      const key = requestKey ?? crypto.randomUUID();
      setRequestKey(key);
      const listing = await api.createListing(shopId, preview.data, key);
      setListingId(listing.id);
      if (listing.status === "ACTIVE" || listing.status === "PENDING_REVIEW") {
        setOutcome(listing.status);
        return;
      }
      if (listing.images.length === 0) await api.uploadCatalogImage(shopId, listing.id, cover);
      const result = await api.publishListing(shopId, listing.id);
      setOutcome(result.policy.outcome);
    } catch (caught) {
      const code = caught instanceof ApiClientError ? caught.code : undefined;
      setError(code === "SHOP_NOT_VERIFIED" ? "Shop cần xác minh trước khi đăng bán."
        : code === "LISTING_DISCLOSURE_REQUIRED" ? "Danh mục này cần mô tả tình trạng chi tiết hơn. Hãy chỉnh sửa bản nháp."
        : "Chưa đăng được sản phẩm. Bạn có thể bấm Đăng bán để thử lại.");
    } finally {
      setPublishing(false);
    }
  }

  function selectMedia(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    if (!allowedMedia.includes(file.type) || (file.type !== "video/mp4" && file.size > maxCatalogImageBytes)) {
      if (fileInput.current) fileInput.current.value = "";
      setError("Hãy chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MiB, hoặc video MP4.");
      return;
    }
    setSelectedFile(file);
  }

  function reset() {
    setRequestKey(undefined);
    setTurns([]);
    setMessage("");
    clearSelection();
    setSuggestion(undefined);
    setListingId(undefined);
    setOutcome(undefined);
    setError(undefined);
  }

  return (
    <section aria-labelledby="quick-listing-title" className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-col overflow-hidden rounded-[20px] border border-[var(--line)] bg-white shadow-[0_10px_32px_rgba(16,40,69,0.06)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--line)] px-3.5 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[13px] border border-[var(--line)] bg-[var(--accent-soft)] sm:size-11">
            <Image alt="" height={23} src="/reboxe/logo.png" unoptimized width={23} />
          </div>
          <div>
            <h1 className="text-lg leading-tight font-bold sm:text-xl" id="quick-listing-title">Đăng nhanh</h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Trợ lý đăng bán REBOXE</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
          <Link className="inline-flex min-h-10 items-center rounded-lg px-2.5 py-2 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]" href="/seller/products/new#listing-form">Đăng thủ công</Link>
          {(turns.length > 0 || outcome) && <button className="min-h-10 rounded-lg border border-[var(--line-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-[var(--accent-strong)] hover:bg-[var(--line)] disabled:opacity-50" disabled={busy} onClick={reset} type="button">Tin mới</button>}
        </div>
      </header>

      <div aria-label="Cuộc trò chuyện" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-[var(--paper)]" ref={transcript} role="log">
        <div className="mx-auto grid max-w-[760px] gap-5 p-3.5 sm:gap-6 sm:px-7 sm:py-6">
          <AssistantBubble>
            <p>Bạn muốn bán món gì? Gửi một ảnh hoặc video kèm vài dòng về món đồ và giá bạn muốn bán nhé.</p>
          </AssistantBubble>
          {turns.map((turn, index) => (
            <div className="grid min-w-0 gap-5 sm:gap-6" key={index}>
              <SellerBubble turn={turn} />
              {turn.reply && <AssistantBubble><p>{turn.reply}</p></AssistantBubble>}
            </div>
          ))}
          {pendingTurn && <>
            <SellerBubble turn={pendingTurn} />
            <AssistantBubble><p className="text-[var(--muted)]" role="status">Đang suy nghĩ ...</p></AssistantBubble>
          </>}
          {!pendingTurn && preview.success && <AssistantBubble>
            <h2 className="text-sm font-bold text-[var(--accent-strong)]">Xem trước tin đăng</h2>
            <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                {file && <AttachmentPreview compact file={file} />}
                <div className="min-w-0">
                  <p className="font-bold break-words">{preview.data.title}</p>
                  <p className="text-base font-bold tabular-nums text-[var(--accent)]">{money.format(preview.data.price)}</p>
                </div>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{categories.find(category => category.id === preview.data.categoryId)?.name ?? preview.data.categoryId} · {conditionLabels[preview.data.conditionGrade]} · {preview.data.weightGram} g</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{preview.data.conditionNotes}</p>
              {preview.data.description && <p className="mt-1 whitespace-pre-wrap break-words">{preview.data.description}</p>}
            </div>
            {!outcome && <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button className="min-h-10 rounded-lg bg-[var(--accent-strong)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--ink)] disabled:bg-[var(--accent-soft)] disabled:text-[var(--muted)]" disabled={Boolean(busy || !file || message.trim() || selectedFile)} onClick={() => void publish()} type="button">{publishing ? "Đang đăng…" : "Đăng bán"}</button>
              {!file && <p className="text-xs text-[var(--muted)]">Gửi ảnh hoặc video để đăng bán.</p>}
              {listingId && <Link className="inline-flex min-h-10 items-center text-xs font-semibold text-[var(--accent)] hover:underline" href={`/seller/products/new?edit=${encodeURIComponent(listingId)}#listing-form`}>Mở bản nháp</Link>}
            </div>}
          </AssistantBubble>}
          {error && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900" role="alert">{error}</p>}
          {outcome && <AssistantBubble><p className="font-semibold text-[var(--success)]" role="status">{outcome === "ACTIVE" ? "Sản phẩm đã được đăng bán." : "Sản phẩm đã được gửi duyệt."}</p></AssistantBubble>}
          {turnLimitReached && !preview.success && <AssistantBubble><p>Bạn có thể <Link className="font-semibold text-[var(--accent)] underline" href="/seller/products/new#listing-form">điền phần còn lại trong form đăng thủ công</Link>.</p></AssistantBubble>}
        </div>
      </div>

      {!outcome && <form className="shrink-0 border-t border-[var(--line)] bg-white p-2.5 sm:px-5 sm:py-3" onSubmit={event => void send(event)}>
        <div className="mx-auto max-w-[760px]">
          {selectedFile && !pendingTurn && <div className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-1.5 pr-2">
            <AttachmentPreview compact file={selectedFile} />
            <span className="truncate text-xs font-semibold text-[var(--accent-strong)]" title={selectedFile.name}>{selectedFile.name}</span>
            <button aria-label="Bỏ tệp đính kèm" className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--accent-strong)] hover:bg-[var(--line)]" onClick={clearSelection} type="button">
              <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 16 16" width="16"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>}
          <div className="flex items-end gap-1.5 rounded-[16px] border border-[var(--line-strong)] bg-[var(--paper)] p-1.5 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)] sm:gap-2 sm:p-2" data-focus-ring-parent>
            <input accept={allowedMedia.join(",")} hidden onChange={event => selectMedia(event.target.files?.[0])} ref={fileInput} type="file" />
            <button aria-label="Đính kèm ảnh hoặc video" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:bg-[var(--line)] disabled:opacity-50" disabled={busy} onClick={() => fileInput.current?.click()} title="Đính kèm ảnh hoặc video" type="button">
              <svg aria-hidden fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 20 20" width="20"><path d="M10 4v12M4 10h12" /></svg>
            </button>
            <textarea aria-label="Tin nhắn đăng bán" className="max-h-28 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-base leading-6 [field-sizing:content] disabled:opacity-65 sm:text-sm" disabled={Boolean(busy || requestKey || turnLimitReached)} maxLength={maxQuickListingMessageLength} onChange={event => setMessage(event.target.value)} onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} placeholder="Nhắn về món bạn muốn bán…" ref={composer} rows={1} value={message} />
            <button className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-bold text-white hover:bg-[var(--ink)] disabled:bg-[var(--accent-soft)] disabled:text-[var(--muted)]" disabled={!canSend} type="submit">
              Gửi
              <svg aria-hidden fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 16 16" width="16"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>
            </button>
          </div>
          {turns.length === 0 && !pendingTurn && <button className="mt-1.5 inline-flex min-h-9 items-center px-1 text-xs font-semibold text-[var(--accent)] hover:underline" onClick={() => {
            setMessage("Mình pass đầm hoa size M giá 140k, mặc vài lần, khóa kéo hơi xước.");
            composer.current?.focus();
          }} type="button">Dùng câu mẫu</button>}
        </div>
      </form>}
    </section>
  );
}
