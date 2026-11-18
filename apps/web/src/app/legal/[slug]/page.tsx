import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicApiClient } from "../../../platform/api/server";

const legalLinks = [
  { slug: "marketplace-rules", label: "Quy chế sàn" },
  { slug: "privacy-policy", label: "Chính sách bảo mật" },
  { slug: "dispute-process", label: "Giải quyết tranh chấp" },
  { slug: "processing-notice", label: "Thông báo xử lý dữ liệu" }
] as const;

function renderBlocks(body: string) {
  const hasChapters = /^CHƯƠNG /m.test(body);
  return body.split(/\n\n+/).map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const first = lines[0]!;
    if (first === "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM") {
      return (
        <div className="mb-6 border-b border-[var(--line)] pb-5 text-center" key={index}>
          <p className="text-sm font-bold tracking-wide text-[var(--ink)]">{first}</p>
          {lines[1] ? <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{lines[1]}</p> : null}
          <span aria-hidden className="mx-auto mt-2 block h-px w-36 bg-[var(--ink)]/50" />
        </div>
      );
    }

    if (index <= 2 && first === first.toUpperCase() && first !== first.toLowerCase() && !/^CĂN CỨ PHÁP LÝ|^CHƯƠNG /.test(first)) {
      return (
        <div className="mb-6 text-center" key={index}>
          <p className="text-base font-bold leading-snug text-[var(--ink)] text-balance sm:text-lg">{first}</p>
          {lines.slice(1).map((line, i) => (
            <p className="mt-1.5 text-sm italic leading-6 text-[var(--muted)] text-pretty" key={i}>{line}</p>
          ))}
        </div>
      );
    }

    if (/^ĐẠI DIỆN ĐƠN VỊ VẬN HÀNH/i.test(first)) {
      return (
        <div className="mt-8 border-t border-[var(--line)] pt-6 text-right text-sm text-[var(--ink)]" key={index}>
          <p className="font-bold">{first}</p>
          {lines.slice(1).map((line, i) => (
            <p className="mt-1 italic text-[var(--muted)]" key={i}>{line}</p>
          ))}
        </div>
      );
    }

    if (/^CHƯƠNG [IVXLC]+\./i.test(first)) {
      return (
        <h2 className="mt-8 border-b border-[var(--line)] pb-2 text-center text-base font-bold tracking-wide text-[var(--ink)] text-balance" key={index}>
          {first}
        </h2>
      );
    }

    if (/^(Điều \d+\.|CĂN CỨ PHÁP LÝ)/i.test(first)) {
      const rest = lines.slice(1);
      const allBullets = rest.length > 0 && rest.every((line) => /^[-•]/.test(line));
      const HeadingTag = /^CĂN CỨ PHÁP LÝ/i.test(first) || !hasChapters ? "h2" : "h3";
      return (
        <section className="mt-6 space-y-2.5" key={index}>
          <HeadingTag className="text-[16px] font-bold leading-6 text-[var(--ink)] text-balance">{first}</HeadingTag>
          {allBullets ? (
            <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-[var(--ink)]">
              {rest.map((line, i) => <li className="text-pretty" key={i}>{line.replace(/^[-•]\s*/, "")}</li>)}
            </ul>
          ) : (
            rest.map((line, i) => {
              const isSubPoint = /^[a-zđ]\)\s/i.test(line);
              return (
                <p
                  className={`text-[15px] leading-7 text-[var(--ink)] text-pretty ${isSubPoint ? "pl-5" : ""}`}
                  key={i}
                >
                  {line}
                </p>
              );
            })
          )}
        </section>
      );
    }

    if (lines.every((line) => /^[-•]/.test(line))) {
      return (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-[var(--ink)]" key={index}>
          {lines.map((line, i) => <li className="text-pretty" key={i}>{line.replace(/^[-•]\s*/, "")}</li>)}
        </ul>
      );
    }

    return (
      <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-[var(--ink)] text-pretty" key={index}>
        {trimmed}
      </p>
    );
  });
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let artifact: { title: string; body: string; version: string; effectiveAt: string };
  try { artifact = await createPublicApiClient().getLegalArtifact(slug); } catch { notFound(); }

  return (
    <main className="bg-[var(--paper)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[904px] items-start gap-8 max-md:flex-col">
        <aside className="w-full shrink-0 md:sticky md:top-6 md:w-[232px]">
          <p className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Văn bản pháp lý
          </p>
          <nav aria-label="Văn bản pháp lý REBOXE" className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
            {legalLinks.map((item) => {
              const active = item.slug === slug;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 w-full items-center rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--accent-soft)]"}`}
                  href={`/legal/${item.slug}`}
                  key={item.slug}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <article className="w-full min-w-0 max-w-[640px] flex-1 rounded-xl border border-[var(--line)] bg-white p-6 sm:p-10">
          <header className="border-b border-[var(--line)] pb-6">
            <h1 className="text-2xl font-bold text-balance text-[var(--ink)] sm:text-3xl">{artifact.title}</h1>
            <p className="mt-2 text-sm tabular-nums text-[var(--muted)]">
              Phiên bản {artifact.version} · Hiệu lực từ {new Date(artifact.effectiveAt).toLocaleDateString("vi-VN")}
            </p>
          </header>

          <div>{renderBlocks(artifact.body)}</div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-6 text-sm">
            <span className="text-[var(--muted)]">Cần giải đáp hoặc gửi yêu cầu hỗ trợ về quy định trên REBOXE?</span>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-[var(--line-strong)] px-4 py-2 font-semibold text-[var(--accent)] hover:bg-[var(--paper)]" href="/support">
              Liên hệ Hỗ trợ REBOXE
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
