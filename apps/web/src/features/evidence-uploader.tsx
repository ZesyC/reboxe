"use client";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();
export function EvidenceUploader({ caseId, purpose }: { caseId: string; purpose: "DISPUTE_EVIDENCE" | "SELLER_EVIDENCE" }) {
  const [notice, setNotice] = useState<{ title: string; body: string; version: string }>();
  const [consent, setConsent] = useState(false);
  const [recordId, setRecordId] = useState<string>();
  const [uploadId, setUploadId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  useEffect(() => { void api.getLegalArtifact("processing-notice").then(setNotice).catch(() => setMessage("Chưa tải được thông báo xử lý dữ liệu. Vui lòng thử lại sau.")); }, []);
  async function prepare() {
    if (!notice || !consent) return;
    setBusy(true); setMessage(undefined);
    try { setRecordId((await api.createProcessingRecord({ purpose, targetType: "DISPUTE", targetId: caseId, noticeVersion: notice.version })).id); }
    catch { setMessage("Chưa ghi nhận được lựa chọn xử lý dữ liệu. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  async function confirm(id: string) {
    setBusy(true);
    try {
      await api.completeEvidenceUpload(caseId, id);
      setUploadId(undefined); setRecordId(undefined); setConsent(false);
      setMessage("Đã nhận và kiểm tra bằng chứng. Bản gốc được lưu riêng; chỉ bản đã che thông tin mới được chia sẻ cho bên còn lại.");
    } catch { setMessage("File chưa được xác nhận. Bạn có thể thử xác nhận lại; không cần tải file thêm lần nữa."); }
    finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || !recordId) return;
    if (file.size > 20 * 1024 * 1024) { setMessage("File phải nhỏ hơn 20 MiB; video tối đa 90 giây."); return; }
    setBusy(true); setMessage("Đang tải và kiểm tra bằng chứng...");
    try {
      const result = await api.uploadEvidence(caseId, recordId, file);
      setUploadId(result.uploadId);
      await confirm(result.uploadId);
    } catch { setMessage("Chưa tải được bằng chứng. Kho lưu trữ có thể chưa sẵn sàng; bạn vẫn có thể gửi khiếu nại không kèm file."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3 rounded border p-3 text-sm">
    <p className="font-bold">Bổ sung bằng chứng</p>
    {notice ? <><details><summary>{notice.title}</summary><p className="mt-2 whitespace-pre-wrap">{notice.body}</p></details><label className="flex gap-2"><input type="checkbox" checked={consent} disabled={busy || Boolean(recordId)} onChange={(event) => setConsent(event.target.checked)} /><span>Tôi đồng ý xử lý file cho hồ sơ khiếu nại theo thông báo phiên bản {notice.version}.</span></label></> : null}
    {!recordId ? <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={!consent || !notice || busy} onClick={() => void prepare()} type="button">Xác nhận lựa chọn để chọn file</button> : <label className="block">Chọn ảnh hoặc video (tối đa 90 giây, 20 MiB)<input className="mt-1 block" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" disabled={busy || Boolean(uploadId)} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} type="file" /></label>}
    {uploadId ? <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={busy} onClick={() => void confirm(uploadId)} type="button">Thử xác nhận lại file đã tải</button> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
