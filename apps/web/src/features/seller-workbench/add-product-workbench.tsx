"use client";

import { ApiClientError } from "@reboxe/api-client";
import type { ActorContext, Category, Listing, ReturnManifestPreview } from "@reboxe/shared";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createBrowserApiClient } from "../../platform/api/browser";
import { PackageScanner } from "../package-scanner";

const api = createBrowserApiClient();

export function AddProductWorkbench() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [actor, setActor] = useState<ActorContext>();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string>();
  const [manifestPreview, setManifestPreview] = useState<ReturnManifestPreview>();
  const [manifestFileName, setManifestFileName] = useState<string>();
  const [manifestIdempotencyKey, setManifestIdempotencyKey] = useState<string>();
  const [manifestCommitted, setManifestCommitted] = useState(false);
  const [committedPackageIds, setCommittedPackageIds] = useState<string[]>([]);
  const [scanCode, setScanCode] = useState("");
  const manifestFileInput = useRef<HTMLInputElement>(null);

  const shop = actor?.shops[0];
  const editingListing = editId ? listings.find((listing) => listing.id === editId) : undefined;

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(false);
    try {
      setCategories(await api.listCategories());
    } catch {
      setCategoriesError(true);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const nextActor = await api.getMe();
      setActor(nextActor);
      const firstShop = nextActor.shops[0];
      if (firstShop) {
        setListings(await api.listShopListings(firstShop.id));
      }
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.status === 401
        ? "Bạn cần đăng nhập để mở kênh người bán."
        : "Không tải được dữ liệu người bán. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    void loadCategories();
  }, [loadCategories, reload]);

  async function saveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      title: String(data.get("title")),
      description: String(data.get("description")),
      categoryId: String(data.get("categoryId")),
      conditionGrade: String(data.get("conditionGrade")) as Listing["conditionGrade"],
      conditionNotes: String(data.get("conditionNotes")),
      price: Number(data.get("price")),
      weightGram: Number(data.get("weightGram"))
    };
    const currentEditingId = editingListing?.id;
    setAction(currentEditingId ? `update-${currentEditingId}` : "create-listing");
    setError(undefined);
    setSuccess(undefined);
    try {
      const saved = currentEditingId
        ? await api.updateListingDraft(shop.id, currentEditingId, input)
        : await api.createListing(shop.id, input);
      setListings((current) => currentEditingId
        ? current.map((listing) => listing.id === saved.id ? saved : listing)
        : [saved, ...current]);
      if (!currentEditingId) form.reset();
      setSuccess(currentEditingId ? "Đã cập nhật bản nháp." : "Đã lưu bản nháp.");
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.code === "INVALID_CATEGORY"
        ? "Danh mục đã chọn không còn khả dụng. Dữ liệu bạn vừa nhập vẫn được giữ nguyên."
        : caught instanceof ApiClientError && caught.code === "VALIDATION_FAILED"
        ? "Thông tin sản phẩm chưa hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc."
        : caught instanceof ApiClientError && caught.code === "INVALID_LISTING_STATE"
          ? "Chỉ bản nháp mới có thể chỉnh sửa. Dữ liệu bạn vừa nhập vẫn được giữ nguyên."
          : "Không thể lưu bản nháp. Dữ liệu bạn vừa nhập vẫn được giữ nguyên để thử lại.");
    } finally {
      setAction(undefined);
    }
  }

  async function previewManifest(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!shop || !file) return;
    setAction("preview-manifest");
    setError(undefined);
    setSuccess(undefined);
    setManifestCommitted(false);
    try {
      const preview = await api.previewReturnManifest(shop.id, file);
      setManifestPreview(preview);
      setManifestFileName(file.name);
      setManifestIdempotencyKey(crypto.randomUUID());
    } catch (caught) {
      setManifestPreview(undefined);
      setError(caught instanceof ApiClientError && caught.code === "PII_COLUMN_FORBIDDEN"
        ? "File có cột dữ liệu người mua/người nhận bị cấm. Hãy xóa cột đó rồi thử lại."
        : "Không thể đọc bản kê. Hãy dùng đúng mẫu CSV/XLSX 24 cột.");
    } finally {
      input.value = "";
      setAction(undefined);
    }
  }

  async function commitManifest() {
    if (!shop || !manifestPreview?.canCommit || !manifestIdempotencyKey) return;
    setAction("commit-manifest");
    setError(undefined);
    setSuccess(undefined);
    try {
      const result = await api.commitReturnManifest(shop.id, manifestPreview.batchId, manifestIdempotencyKey);
      setManifestCommitted(true);
      setCommittedPackageIds(result.packageIds);
      setSuccess(`Đã nhập ${result.packageIds.length} kiện và ${result.lineCount} dòng khai báo.`);
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.code === "MANIFEST_PACKAGE_CONFLICT"
        ? "Có kiện đã tồn tại với bản kê khác. Dữ liệu cũ không bị ghi đè."
        : caught instanceof ApiClientError && caught.code === "MANIFEST_IDEMPOTENCY_CONFLICT"
          ? "Mã retry đã được dùng cho một bản kê khác."
          : "Không thể commit bản kê. Bạn có thể thử lại an toàn.");
    } finally {
      setAction(undefined);
    }
  }

  async function scanPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop || !scanCode.trim()) return;
    setAction("scan-package"); setError(undefined);
    try {
      const result = await api.scanReturnPackage(shop.id, { scannedCode: scanCode, codeType: "UNKNOWN", platformHint: null }, crypto.randomUUID());
      setListings((current) => current.some((listing) => listing.id === result.listing.id) ? current : [result.listing, ...current]);
      setSuccess(`Đã mở bản nháp cho kiện ${result.packageId}. Kiện chưa mở kiểm tra.`);
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.code === "SOURCE_MANIFEST_NOT_FOUND" ? "Không tìm thấy mã trong bản kê của shop." : "Không thể tạo listing từ kiện này.");
    } finally { setAction(undefined); }
  }

  async function createAllPackageDrafts() {
    if (!shop || committedPackageIds.length === 0) return;
    setAction("batch-package"); setError(undefined);
    try {
      const results = await api.batchCreatePackageListings(shop.id, committedPackageIds);
      const created = results.flatMap((result) => result.listing ? [result.listing] : []);
      setListings((current) => [...created.filter((item) => !current.some((old) => old.id === item.id)), ...current]);
      setSuccess(`Đã xử lý ${results.length} kiện: ${created.length} bản nháp sẵn sàng.`);
    } catch { setError("Không thể tạo bản nháp hàng loạt."); } finally { setAction(undefined); }
  }

  if (loading) {
    return (
      <div className="mt-6 grid animate-pulse gap-5" aria-label="Đang tải" aria-busy="true">
        <div className="h-16 rounded-[18px] bg-slate-200" />
        <div className="h-[420px] rounded-[18px] bg-white" />
      </div>
    );
  }

  if (error && !actor) {
    return (
      <section className="mt-6 rounded-[18px] border border-red-200 bg-white p-6 shadow-[0_12px_35px_rgba(35,63,101,0.06)]" role="alert">
        <h2 className="text-xl font-black">Chưa thể mở trang này</h2>
        <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
        <Link className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white" href="/login">
          Đi đến đăng nhập
        </Link>
      </section>
    );
  }

  if (!shop) {
    return (
      <section className="mt-6 max-w-2xl rounded-[18px] border border-[var(--line)] bg-white p-6 shadow-[0_12px_35px_rgba(35,63,101,0.06)] sm:p-8">
        <p className="text-sm font-bold text-[var(--accent)]">Bạn chưa có shop</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Đăng ký trở thành người bán</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Hoàn thành hồ sơ shop, địa chỉ lấy hàng, eKYC và cấu hình vận chuyển trước khi vào Kênh người bán.</p>
        <Link className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white" href="/seller/onboarding">Bắt đầu đăng ký</Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6">

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800" role="alert">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800" role="status">{success}</p> : null}

      <section className="rounded-[18px] border border-[var(--line)] bg-white p-5 shadow-[0_12px_35px_rgba(35,63,101,0.06)] sm:p-7">
        <h2 className="text-xl font-black tracking-tight">Nhập bản kê hàng hoàn</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Chọn một nguồn. Cả hai nguồn dùng chung màn xem trước khi tạo kiện.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link className="rounded-xl border border-[var(--line-strong)] px-5 py-4 text-left font-bold text-[var(--accent)]" href="/seller/connections">Kết nối Shopee/TikTok <span className="block text-xs font-semibold">Quản lý quyền truy cập shop</span></Link>
          <button
            className="rounded-xl bg-[var(--accent)] px-5 py-4 text-left font-bold text-white disabled:opacity-60"
            disabled={action === "preview-manifest"}
            onClick={() => manifestFileInput.current?.click()}
            type="button"
          >
            {action === "preview-manifest" ? "Đang đọc file..." : "Import bằng CSV/XLSX"}
            <span className="block text-xs font-semibold">Chọn file để xem trước</span>
          </button>
          <input
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-describedby="manifest-file-help"
            aria-label="File bản kê CSV hoặc XLSX"
            className="sr-only"
            onChange={(event) => void previewManifest(event)}
            ref={manifestFileInput}
            type="file"
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]" id="manifest-file-help">Chấp nhận file .csv hoặc .xlsx theo mẫu 24 cột, tối đa 5 MiB. Không đưa thông tin người mua/người nhận vào file.</p>

        {manifestPreview ? (
          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-black">Xem trước {manifestFileName}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{manifestPreview.drafts.length} kiện · {manifestPreview.rows.length} dòng</p>
              </div>
              <button
                className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={!manifestPreview.canCommit || manifestCommitted || action === "commit-manifest"}
                onClick={() => void commitManifest()}
                type="button"
              >
                {manifestCommitted ? "Đã nhập" : action === "commit-manifest" ? "Đang nhập..." : "Xác nhận nhập"}
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Dòng</th>
                    <th className="px-4 py-3 font-bold">Nhóm kiện</th>
                    <th className="px-4 py-3 font-bold">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {manifestPreview.rows.map((row) => (
                    <tr className="border-t border-[var(--line)]" key={row.rowIndex}>
                      <td className="px-4 py-3 tabular-nums">{row.rowIndex}</td>
                      <td className="px-4 py-3 font-semibold">{row.packageGroup}</td>
                      <td className={`px-4 py-3 ${row.errorCodes.length ? "text-red-700" : "text-emerald-700"}`}>
                        {row.errorCodes.length ? row.errorCodes.join(", ") : "Hợp lệ"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[18px] border border-[var(--line)] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-black">Quét hoặc chọn kiện để đăng bán</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Quét mã của kiện đã nhập vào kho. Mỗi kiện tạo đúng một bản nháp để bạn kiểm tra trước khi đăng bán.</p>
        <PackageScanner onCode={setScanCode} />
        <form className="mt-4 flex gap-3" onSubmit={scanPackage}>
          <input aria-label="Mã kiện" className="min-w-0 flex-1 rounded-xl border border-[var(--line-strong)] px-4" onChange={(event) => setScanCode(event.target.value)} placeholder="Nhập mã tracking đã import" value={scanCode} />
          <button className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={action === "scan-package" || !scanCode.trim()}>Tạo bản nháp</button>
        </form>
        {manifestCommitted ? <button className="mt-3 rounded-xl border border-[var(--accent)] px-5 py-3 font-bold text-[var(--accent)] disabled:opacity-50" disabled={action === "batch-package"} onClick={() => void createAllPackageDrafts()} type="button">Tạo bản nháp cho cả {committedPackageIds.length} kiện</button> : null}
      </section>

      <form id="listing-form" key={editingListing?.id ?? "new"} className="scroll-mt-28 rounded-[18px] border border-[var(--line)] bg-white shadow-[0_12px_35px_rgba(35,63,101,0.06)]" onSubmit={saveListing}>
        <div className="border-b border-[var(--line)] px-5 py-5 sm:px-7">
          <h2 className="text-xl font-black tracking-tight">{editingListing ? "Chỉnh sửa bản nháp" : "Thông tin sản phẩm"}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{editingListing ? `Đang sửa ${editingListing.title}.` : "Các trường có dấu * là bắt buộc trước khi lưu bản nháp."}</p>
        </div>

        <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-7">
          <label className="grid gap-2 text-sm font-bold sm:col-span-2" htmlFor="title">
            Tên sản phẩm *
            <input className="rounded-xl border border-[var(--line-strong)] px-4 py-3.5 font-normal transition-colors hover:border-slate-400" defaultValue={editingListing?.title} id="title" name="title" minLength={3} maxLength={180} placeholder="Nhập tên sản phẩm rõ ràng, dễ tìm kiếm" required />
          </label>

          <div className="grid gap-2 text-sm font-bold">
            <label htmlFor="categoryId">Danh mục *</label>
            <select
              className="rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3.5 font-normal transition-colors hover:border-slate-400 disabled:bg-slate-100"
              defaultValue={editingListing?.categoryId ?? ""}
              disabled={categoriesLoading || categoriesError || categories.length === 0}
              id="categoryId"
              name="categoryId"
              required
            >
              <option disabled value="">
                {categoriesLoading ? "Đang tải danh mục..." : categories.length === 0 ? "Chưa có danh mục khả dụng" : "Chọn danh mục"}
              </option>
              {editingListing && !categories.some((category) => category.id === editingListing.categoryId)
                ? <option value={editingListing.categoryId}>Danh mục hiện tại không còn khả dụng</option>
                : null}
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {categoriesError ? (
              <span className="font-normal text-red-700" role="alert">
                Không tải được danh mục.{" "}
                <button className="font-bold underline" onClick={() => void loadCategories()} type="button">Thử lại</button>
              </span>
            ) : null}
            {!categoriesLoading && !categoriesError && categories.length === 0
              ? <span className="font-normal text-[var(--muted)]">Hiện chưa có danh mục đang hoạt động.</span>
              : null}
          </div>

          <label className="grid gap-2 text-sm font-bold" htmlFor="conditionGrade">
            Tình trạng *
            <select className="rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3.5 font-normal transition-colors hover:border-slate-400" defaultValue={editingListing?.conditionGrade ?? "NEW_SEALED"} id="conditionGrade" name="conditionGrade">
              <option value="NEW_SEALED">Mới nguyên seal</option>
              <option value="LIKE_NEW_99">Gần như mới</option>
              <option value="GOOD">Còn tốt</option>
              <option value="FAIR">Đã qua sử dụng</option>
              <option value="DEFECT">Có lỗi</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold" htmlFor="price">
            Giá bán dự kiến (VNĐ) *
            <input className="rounded-xl border border-[var(--line-strong)] px-4 py-3.5 font-normal transition-colors hover:border-slate-400" defaultValue={editingListing?.price} id="price" name="price" type="number" inputMode="numeric" min={1} placeholder="450000" required />
          </label>

          <label className="grid gap-2 text-sm font-bold" htmlFor="weightGram">
            Khối lượng (gram) *
            <input className="rounded-xl border border-[var(--line-strong)] px-4 py-3.5 font-normal transition-colors hover:border-slate-400" defaultValue={editingListing?.weightGram} id="weightGram" name="weightGram" type="number" inputMode="numeric" min={1} max={100000} placeholder="500" required />
          </label>

          <label className="grid gap-2 text-sm font-bold sm:col-span-2" htmlFor="conditionNotes">
            Mô tả tình trạng và khuyết điểm *
            <textarea className="min-h-28 resize-y rounded-xl border border-[var(--line-strong)] px-4 py-3.5 font-normal leading-6 transition-colors hover:border-slate-400" defaultValue={editingListing?.conditionNotes} id="conditionNotes" name="conditionNotes" minLength={3} maxLength={2000} placeholder="Ghi rõ vết xước, móp, thiếu phụ kiện hoặc dấu hiệu đã qua sử dụng" required />
          </label>

          <label className="grid gap-2 text-sm font-bold sm:col-span-2" htmlFor="description">
            Mô tả bổ sung
            <textarea className="min-h-24 resize-y rounded-xl border border-[var(--line-strong)] px-4 py-3.5 font-normal leading-6 transition-colors hover:border-slate-400" defaultValue={editingListing?.description} id="description" name="description" maxLength={5000} placeholder="Thông tin chất liệu, kích thước, phụ kiện đi kèm" />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--line)] bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-sm leading-6 text-[var(--muted)]">Bạn có thể chỉnh sửa bản nháp trước khi đăng bán.</p>
          <div className="flex gap-3">
            {editingListing ? (
              <Link className="inline-flex items-center rounded-xl border border-[var(--line-strong)] bg-white px-5 py-3 font-bold text-[var(--ink)]" href="/seller/products/new">
                Hủy chỉnh sửa
              </Link>
            ) : null}
            <button className="rounded-xl bg-[var(--accent)] px-6 py-3 font-bold text-white shadow-[0_7px_16px_rgba(25,104,238,0.2)] transition-transform active:translate-y-px disabled:opacity-60" disabled={action === "create-listing" || action === `update-${editingListing?.id}`}>
              {action === "create-listing" || action === `update-${editingListing?.id}` ? "Đang lưu..." : editingListing ? "Lưu thay đổi" : "Lưu bản nháp"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
