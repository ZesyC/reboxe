"use client";

import { useState } from "react";
import type { AiReport } from "@reboxe/shared";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();
export function AiCaseReview({ caseId }: { caseId: string }) {
  const [reports, setReports] = useState<Array<{ id: string; evidenceId: string; report: AiReport; createdAt: string }>>([]);
  const [evidenceId, setEvidenceId] = useState("");
  const [evidences, setEvidences] = useState<Array<{ id: string; stored: boolean }>>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError(undefined);
    try {
      const [items, results] = await Promise.all([api.listAiEvidence(caseId), api.listAiReports(caseId)]);
      setEvidences(items); setReports(results); setEvidenceId(items[0]?.id ?? "");
    } catch { setError("Không thể tải hồ sơ AI. Kiểm tra quyền quản trị và MFA."); }
    finally { setBusy(false); }
  }
  async function analyze(file?: File) {
    if (!file || !evidenceId) return;
    if (file.size > 20 * 1024 * 1024) { setError("File vượt giới hạn 20 MiB."); return; }
    setBusy(true); setError(undefined);
    try { setReports(await api.analyzeEvidence(caseId, evidenceId, file)); }
    catch { setError("AI chưa sẵn sàng hoặc file không khớp bằng chứng đã ghi nhận. Tiếp tục xem xét thủ công."); }
    finally { setBusy(false); }
  }
  async function analyzeStored() {
    if (!evidenceId) return;
    setBusy(true); setError(undefined);
    try { setReports(await api.analyzeStoredEvidence(caseId, evidenceId)); }
    catch { setError("Chưa thể phân tích bản lưu. Tiếp tục xem xét thủ công hoặc thử lại sau."); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-lg border border-[var(--line)] p-4">
    <h3 className="font-bold">AI hỗ trợ xem xét</h3>
    <p className="mt-1 text-sm">Nhận xét về khung hình mẫu cần được người duyệt kiểm tra. AI không xác nhận tính liên tục của video hoặc quyết định hoàn tiền.</p>
    <button className="mt-3 text-sm text-[var(--accent)] underline disabled:opacity-50" disabled={busy} onClick={() => void load()} type="button">Tải báo cáo và danh sách bằng chứng</button>
    {evidences.find((item) => item.id === evidenceId)?.stored ? <button className="mt-3 ml-3 rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={() => void analyzeStored()} type="button">Phân tích bản gốc đã lưu</button> : null}
    {evidences.length ? <div className="mt-3 space-y-2"><label className="block text-sm">Bằng chứng cần phân tích<select className="ml-2 rounded border p-2" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}>{evidences.map((item) => <option value={item.id} key={item.id}>{item.id}</option>)}</select></label><label className="block text-sm">Chọn đúng file bằng chứng đã ghi nhận<input className="mt-1 block" disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(event) => { void analyze(event.target.files?.[0]); event.target.value = ""; }} /></label></div> : null}
    {busy ? <p className="mt-2 text-sm" role="status">Đang xử lý...</p> : null}
    {error ? <p className="mt-2 text-sm text-amber-800" role="alert">{error}</p> : null}
    {reports.map(({ id, report }) => <article className="mt-3 rounded bg-[var(--paper)] p-3 text-sm" key={id}>
      <p className="font-bold">{report.visualAssessment.assessment === "VISIBLE_DAMAGE" ? "Có dấu hiệu hư hỏng nhìn thấy" : report.visualAssessment.assessment === "NO_CLEAR_DAMAGE" ? "Chưa thấy hư hỏng rõ ràng" : "Chưa đủ bằng chứng"}</p>
      <p className="mt-1 text-xs">{report.modelId} · {report.modelRevision.slice(0, 12)} · {report.promptVersion}</p>
      <ul className="mt-2 list-disc pl-5">{report.visualAssessment.observations.map((item, index) => <li key={index}>{item.timestamp_seconds}s: {item.description}</li>)}</ul>
      {report.visualAssessment.limitations.map((item, index) => <p className="mt-1" key={index}>{item}</p>)}
      <p className="mt-2 font-medium">Cần quản trị viên xem xét. Chưa thực hiện hành động tài chính.</p>
    </article>)}
  </section>;
}
