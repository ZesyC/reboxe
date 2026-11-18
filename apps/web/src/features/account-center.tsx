"use client";

import type {
  AccountAddress,
  AccountPaymentOverview,
  CreateAccountAddressInput,
  NotificationPreferences,
  PrivacyPreferences,
  CommerceOrder
} from "@reboxe/shared";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserApiClient } from "../platform/api/browser";
import { getSupabaseBrowserClient } from "../platform/auth/browser";
import { AccountShell } from "./account-shell";
import { nameInitials, orderStatusLabels } from "./commerce-data";

const api = createBrowserApiClient();

type AccountIdentity = { username: string; initials: string };

export function useAccountIdentity(): AccountIdentity {
  const [identity, setIdentity] = useState<AccountIdentity>({ username: "Tài khoản", initials: "US" });
  useEffect(() => {
    void getSupabaseBrowserClient().auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (!data.user) return;
      const metadata = data.user.user_metadata as Record<string, unknown>;
      const name = typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : data.user.email?.split("@")[0] || "Tài khoản";
      setIdentity({ username: data.user.email?.split("@")[0] || name, initials: nameInitials(name, "US") });
    });
  }, []);
  return identity;
}

function AccountPage({ activeHref, children }: { activeHref: string; children: ReactNode }) {
  const identity = useAccountIdentity();
  return <AccountShell activeHref={activeHref} {...identity}>{children}</AccountShell>;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white ${className}`}>{children}</section>;
}

function Feedback({ error, notice }: { error?: string | undefined; notice?: string | undefined }) {
  if (!error && !notice) return null;
  return <p className={`mb-4 rounded-md px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role={error ? "alert" : "status"}>{error || notice}</p>;
}

export function PaymentSettings() {
  const [data, setData] = useState<AccountPaymentOverview>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void api.getAccountPaymentOverview().then(setData).catch(() => setError("Không thể tải phương thức thanh toán."));
  }, []);

  return (
    <AccountPage activeHref="/account/payment">
      <Panel className="min-h-[574px] px-5 py-6 sm:px-[30px]">
        <h1 className="border-b border-[var(--line)] pb-3 text-xl font-semibold text-[var(--ink)]">Ngân hàng &amp; Ví điện tử</h1>
        <PaymentSection action={<button className="flex min-h-11 cursor-not-allowed items-center gap-2 rounded-md bg-slate-200 px-5 text-sm font-medium text-slate-600" disabled title="Cần tích hợp cổng thanh toán" type="button"><span aria-hidden className="text-lg font-medium">+</span>Thêm Thẻ Mới</button>} title="Thẻ Tín Dụng/Ghi Nợ">
          {error ? <Feedback error={error} /> : !data ? <EmptyText>Đang tải dữ liệu...</EmptyText> : data.cards.length === 0 ? <EmptyText>Bạn chưa liên kết thẻ. Tính năng này cần cổng thanh toán bảo mật.</EmptyText> : data.cards.map((card) => <PaymentCard key={card.id} title={card.brand} detail={`•••• ${card.last4}`} />)}
        </PaymentSection>
        <PaymentSection action={<Link className="flex min-h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white hover:bg-[var(--accent-strong)]" href="/seller/kyc"><span aria-hidden className="text-lg font-medium">+</span>Liên kết qua eKYC</Link>} title="Tài Khoản Ngân Hàng Của Tôi">
          {!data ? <EmptyText>Đang tải dữ liệu...</EmptyText> : data.bankAccounts.length === 0 ? <EmptyText>Bạn chưa có tài khoản ngân hàng đã gửi xác minh.</EmptyText> : data.bankAccounts.map((bank) => <PaymentCard detail={`${bank.maskedAccountNumber}${bank.accountHolder ? ` · ${bank.accountHolder}` : ""}`} key={bank.id} status={bank.verified ? "Đã xác minh" : "Đang xác minh"} title={bank.bankCode} />)}
        </PaymentSection>
      </Panel>
    </AccountPage>
  );
}

function PaymentSection({ action, children, title }: { action: ReactNode; children: ReactNode; title: string }) {
  return <section className="flex min-h-[240px] flex-col border-b border-[var(--line)] last:border-b-0"><header className="flex min-h-[66px] flex-wrap items-center gap-3 py-3"><h2 className="text-lg font-medium">{title}</h2><div className="ml-auto">{action}</div></header><div className="flex flex-1 flex-col justify-center py-6">{children}</div></section>;
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-center text-base text-[var(--muted)]">{children}</p>;
}

function PaymentCard({ detail, status, title }: { detail: string; status?: string; title: string }) {
  return <div className="flex items-center border border-[var(--line)] px-4 py-3"><span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">₫</span><div className="ml-3"><strong className="block text-sm">{title}</strong><span className="text-xs text-[var(--muted)]">{detail}</span></div>{status ? <span className="ml-auto text-xs font-medium text-[var(--accent)]">{status}</span> : null}</div>;
}

const blankAddress: CreateAccountAddressInput = {
  label: "Nhà riêng", recipientName: "", phone: "", addressLine: "", ward: "", district: "", province: "", isDefault: false
};

export function AddressSettings() {
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [form, setForm] = useState(blankAddress);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void api.listAccountAddresses().then(setAddresses).catch(() => setError("Không thể tải địa chỉ.")).finally(() => setLoading(false));
  }, []);

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(undefined);
    try {
      const created = await api.createAccountAddress(form);
      setAddresses((current) => [created, ...current.map((address) => form.isDefault ? { ...address, isDefault: false } : address)]);
      setForm(blankAddress); setOpen(false);
    } catch { setError("Không thể lưu địa chỉ. Hãy kiểm tra lại thông tin."); }
    finally { setSaving(false); }
  }

  async function removeAddress(id: string) {
    setError(undefined);
    try {
      await api.deleteAccountAddress(id);
      setAddresses(await api.listAccountAddresses());
    } catch { setError("Không thể xóa địa chỉ."); }
  }

  return (
    <AccountPage activeHref="/account/address">
      <Panel className="min-h-[574px] px-5 py-6 sm:px-[30px]">
        <header className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] pb-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--ink)]">Địa chỉ của tôi</h1>
            <p className="mt-1 text-xs text-[var(--muted)]">Dùng khi giao nhận đơn hàng REBOXE</p>
          </div>
          <button
            className="ml-auto min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? "Đóng form" : "+ Thêm địa chỉ"}
          </button>
        </header>
        <div className="pt-5">
          <Feedback error={error} />
          {open ? <AddressForm form={form} onChange={setForm} onSubmit={addAddress} saving={saving} /> : null}
          {loading ? <EmptyText>Đang tải địa chỉ...</EmptyText> : addresses.length === 0 && !open ? <EmptyState title="Bạn chưa có địa chỉ" /> : (
            <div className="space-y-3">
              {addresses.map((address) => (
                <article className="rounded-lg border border-[var(--line)] p-4" key={address.id}>
                  <div className="flex items-start gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{address.recipientName}</strong>
                        <span className="text-sm text-[var(--muted)]">{address.phone}</span>
                        {address.isDefault ? <span className="rounded border border-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">Mặc định</span> : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{address.addressLine}<br />{address.ward}, {address.district}, {address.province}</p>
                      <span className="mt-2 inline-block text-xs font-medium text-[var(--ink)]">{address.label}</span>
                    </div>
                    <button
                      aria-label={`Xóa địa chỉ ${address.recipientName}`}
                      className="ml-auto inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-[var(--danger)] hover:bg-red-50"
                      onClick={() => void removeAddress(address.id)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </AccountPage>
  );
}

function AddressForm({ form, onChange, onSubmit, saving }: { form: CreateAccountAddressInput; onChange: (value: CreateAccountAddressInput) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  const field = (key: Exclude<keyof CreateAccountAddressInput, "isDefault">, label: string) => (
    <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
      <span>{label}</span>
      <input
        className="min-h-11 w-full rounded-md border border-[var(--line-strong)] bg-white px-3 text-sm font-normal text-[var(--ink)]"
        onChange={(event) => onChange({ ...form, [key]: event.target.value })}
        placeholder={label}
        required
        value={String(form[key])}
      />
    </label>
  );
  return (
    <form className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 max-sm:grid-cols-1" onSubmit={onSubmit}>
      {field("recipientName", "Họ và tên")}
      {field("phone", "Số điện thoại")}
      {field("label", "Nhãn địa chỉ")}
      {field("province", "Tỉnh/Thành phố")}
      {field("district", "Quận/Huyện")}
      {field("ward", "Phường/Xã")}
      <div className="col-span-2 max-sm:col-span-1">{field("addressLine", "Số nhà, tên đường")}</div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input checked={form.isDefault} className="size-4 accent-[var(--accent)]" onChange={(event) => onChange({ ...form, isDefault: event.target.checked })} type="checkbox" />
        Đặt làm mặc định
      </label>
      <button className="ml-auto min-h-11 rounded-md bg-[var(--accent)] px-6 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60" disabled={saving} type="submit">
        {saving ? "ĐANG LƯU…" : "LƯU"}
      </button>
    </form>
  );
}

export function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined); setNotice(undefined);
    if (password.length < 8) return setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (password !== confirmation) return setError("Mật khẩu nhập lại chưa khớp.");
    setSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword: password });
      setCurrentPassword(""); setPassword(""); setConfirmation(""); setNotice("Đã đổi mật khẩu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi mật khẩu.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <AccountPage activeHref="/account/password">
      <Panel className="min-h-[574px] px-5 py-6 sm:px-[30px]">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Đổi mật khẩu</h1>
        <div className="mt-3 border-t border-[var(--line)] pt-6">
          <form className="max-w-[500px]" onSubmit={submit}>
            <Feedback error={error} notice={notice} />
            <FormField label="Mật khẩu hiện tại"><input autoComplete="current-password" className="min-h-11 w-full rounded-md border border-[var(--line-strong)] px-3" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></FormField>
            <FormField label="Mật khẩu mới"><input autoComplete="new-password" className="min-h-11 w-full rounded-md border border-[var(--line-strong)] px-3" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></FormField>
            <FormField label="Nhập lại mật khẩu"><input autoComplete="new-password" className="min-h-11 w-full rounded-md border border-[var(--line-strong)] px-3" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></FormField>
            <button className="mt-3 min-h-11 rounded-md bg-[var(--accent)] px-6 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 sm:ml-[160px]" disabled={saving} type="submit">{saving ? "ĐANG LƯU…" : "XÁC NHẬN"}</button>
          </form>
        </div>
      </Panel>
    </AccountPage>
  );
}

const importantNotice = "Thông báo và nhắc nhở quan trọng về tài khoản sẽ không thể bị tắt";
const notificationDefaults: NotificationPreferences = { orderEmail: true, promotionEmail: false, surveyEmail: true, promotionSms: false, promotionZalo: true };

export function NotificationSettings() {
  const [preferences, setPreferences] = useState(notificationDefaults);
  const [inbox, setInbox] = useState<Array<{ id: string; title: string; body: string; readAt: string | null; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => { void Promise.all([api.getNotificationPreferences(), api.listNotifications()]).then(([nextPreferences, notifications]) => { setPreferences(nextPreferences); setInbox(notifications); }).catch(() => setError("Không thể tải thông báo.")).finally(() => setLoading(false)); }, []);
  async function toggle(key: keyof NotificationPreferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next); setError(undefined);
    try { setPreferences(await api.updateNotificationPreferences(next)); }
    catch { setPreferences(preferences); setError("Không thể lưu thay đổi."); }
  }
  const groups: Array<{ title: string; items: Array<{ key: keyof NotificationPreferences; title: string; description: string }> }> = [
    { title: "Email thông báo", items: [
      { key: "orderEmail", title: "Cập nhật đơn hàng", description: "Cập nhật về tình trạng vận chuyển của tất cả các đơn hàng" },
      { key: "promotionEmail", title: "Khuyến mãi", description: "Cập nhật về các ưu đãi và khuyến mãi sắp tới" },
      { key: "surveyEmail", title: "Khảo sát", description: "Đồng ý nhận khảo sát để cho chúng tôi được lắng nghe bạn" }
    ] },
    { title: "Thông báo SMS", items: [{ key: "promotionSms", title: "Khuyến mãi", description: "Cập nhật về các ưu đãi và khuyến mãi sắp tới" }] },
    { title: "Thông báo Zalo", items: [{ key: "promotionZalo", title: "Khuyến mãi (REBOXE Việt Nam)", description: "Cập nhật về các ưu đãi và khuyến mãi sắp tới" }] }
  ];
  return (
    <AccountPage activeHref="/account/notifications">
      <Panel className="px-5 py-6 sm:px-[30px]">
        <h1 className="border-b border-[var(--line)] pb-3 text-xl font-semibold text-[var(--ink)]">Thông báo</h1>
        {error ? <div className="pt-4"><Feedback error={error} /></div> : null}
        {loading ? <div className="p-10"><EmptyText>Đang tải cài đặt...</EmptyText></div> : (
          <>
            <section className="border-b border-[var(--line)] py-6">
              <h2 className="text-lg font-medium">Hộp thư trong ứng dụng</h2>
              <div className="mt-4 space-y-2">
                {inbox.length === 0 ? <EmptyText>Chưa có thông báo.</EmptyText> : inbox.map((item) => (
                  <button
                    className={`block min-h-11 w-full rounded-lg border p-3.5 text-left ${item.readAt ? "border-[var(--line)] opacity-75" : "border-[var(--accent)] bg-[var(--accent-soft)]"}`}
                    key={item.id}
                    onClick={() => void api.markNotificationRead(item.id).then(() => setInbox((rows) => rows.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)))}
                    type="button"
                  >
                    <strong className="text-sm">{item.title}</strong>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.body}</p>
                  </button>
                ))}
              </div>
            </section>
            {groups.map((group) => (
              <section className="border-b border-[var(--line)] py-6 last:border-b-0" key={group.title}>
                <div className="flex items-start gap-4">
                  <div>
                    <h2 className="text-lg font-medium">{group.title}</h2>
                    <p className="mt-1 text-[13px] text-[var(--muted)]">{importantNotice}</p>
                  </div>
                  <div className="ml-auto"><Toggle checked disabled label={`${group.title} quan trọng`} /></div>
                </div>
                <div className="mt-4 space-y-3 pl-6 max-sm:pl-0">
                  {group.items.map((item) => (
                    <div className="flex min-h-[58px] items-start gap-4" key={item.key}>
                      <div>
                        <h3 className="text-sm font-medium">{item.title}</h3>
                        <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{item.description}</p>
                      </div>
                      <div className="ml-auto pt-1"><Toggle checked={preferences[item.key]} label={item.title} onChange={() => void toggle(item.key)} /></div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </Panel>
    </AccountPage>
  );
}

function Toggle({ checked, disabled = false, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange?: () => void }) {
  return (
    <label className={`inline-flex min-h-11 items-center ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
      <input aria-label={label} checked={checked} className="peer sr-only" disabled={disabled} onChange={onChange} type="checkbox" />
      <span
        className="relative block h-7 w-12 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--accent)] peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-strong)]"
        data-motion-reduce-instant
      />
    </label>
  );
}

const privacyDefaults: PrivacyPreferences = { personalizedRecommendations: true, shareUsageAnalytics: false, publicPurchaseActivity: false };

export function PrivacySettings() {
  const [preferences, setPreferences] = useState(privacyDefaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestNotice, setRequestNotice] = useState<string>();
  const [confirmDeletion, setConfirmDeletion] = useState(false);

  useEffect(() => { void api.getPrivacyPreferences().then(setPreferences).catch(() => setError("Không thể tải thiết lập riêng tư.")).finally(() => setLoading(false)); }, []);

  async function toggle(key: keyof PrivacyPreferences) {
    const next = { ...preferences, [key]: !preferences[key] }; setPreferences(next);
    try { setPreferences(await api.updatePrivacyPreferences(next)); } catch { setPreferences(preferences); setError("Không thể lưu thay đổi."); }
  }

  async function requestPrivacy(type: "ACCESS_EXPORT" | "CORRECTION" | "DELETION_ANONYMIZATION") {
    setError(undefined); setRequestNotice(undefined); setConfirmDeletion(false);
    try { const result = await api.createPrivacyRequest(type); setRequestNotice(`Đã tiếp nhận yêu cầu ${result.id}. Trạng thái: ${result.status}.`); }
    catch { setError("Vui lòng xác thực hai bước để thực hiện yêu cầu này."); }
  }

  const rows: Array<{ key: keyof PrivacyPreferences; title: string; description: string }> = [
    { key: "personalizedRecommendations", title: "Gợi ý sản phẩm phù hợp", description: "Dùng hoạt động mua sắm để cá nhân hóa đề xuất trong REBOXE." },
    { key: "shareUsageAnalytics", title: "Chia sẻ dữ liệu sử dụng", description: "Cho phép dùng dữ liệu tổng hợp để cải thiện trải nghiệm." },
    { key: "publicPurchaseActivity", title: "Hiển thị hoạt động mua hàng", description: "Cho phép người khác xem đánh giá và hoạt động mua hàng công khai." }
  ];

  return (
    <AccountPage activeHref="/account/privacy">
      <Panel className="min-h-[574px] px-5 py-6 sm:px-[30px]">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Thiết lập riêng tư</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Bạn có thể thay đổi các lựa chọn này bất cứ lúc nào.</p>
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <Feedback error={error} notice={requestNotice} />
          {loading ? <EmptyText>Đang tải thiết lập...</EmptyText> : rows.map((row) => (
            <div className="flex min-h-[82px] items-center gap-4 border-b border-[var(--line)] py-3" key={row.key}>
              <div>
                <h2 className="text-base font-medium">{row.title}</h2>
                <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{row.description}</p>
              </div>
              <div className="ml-auto"><Toggle checked={preferences[row.key]} label={row.title} onChange={() => void toggle(row.key)} /></div>
            </div>
          ))}
          <section className="mt-6">
            <h2 className="font-bold">Yêu cầu quyền dữ liệu</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Một số yêu cầu cần xác thực hai bước. Dữ liệu bắt buộc theo pháp luật vẫn được lưu trữ theo quy định.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--paper)]" onClick={() => void requestPrivacy("ACCESS_EXPORT")} type="button">Tải bản sao dữ liệu</button>
              <button className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--paper)]" onClick={() => void requestPrivacy("CORRECTION")} type="button">Yêu cầu chỉnh sửa</button>
              {!confirmDeletion ? (
                <button className="min-h-11 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setConfirmDeletion(true)} type="button">Yêu cầu xóa dữ liệu</button>
              ) : null}
            </div>
            {confirmDeletion ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-900" role="alertdialog" aria-label="Xác nhận yêu cầu xóa dữ liệu">
                <span>Yêu cầu xóa dữ liệu tài khoản có thể đăng xuất bạn. Bạn chắc chắn tiếp tục?</span>
                <div className="ml-auto flex gap-2">
                  <button className="min-h-10 rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-[var(--ink)]" onClick={() => setConfirmDeletion(false)} type="button">Hủy</button>
                  <button className="min-h-10 rounded-md bg-red-700 px-3 text-sm font-semibold text-white" onClick={() => void requestPrivacy("DELETION_ANONYMIZATION")} type="button">Xác nhận xóa</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </Panel>
    </AccountPage>
  );
}

type PersonalData = { email: string; phone: string; fullName: string; citizenId: string; dateOfBirth: string; gender: string; address: string; status: string };
export function PersonalInformation() {
  const [data, setData] = useState<PersonalData>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void (async () => {
      try {
        const [{ data: auth }, actor] = await Promise.all([getSupabaseBrowserClient().auth.getUser(), api.getMe()]);
        const owner = actor.shops.find((shop) => shop.role === "OWNER" && shop.kycId);
        const kyc = owner?.kycId ? await api.getKycStatus(owner.kycId) : undefined;
        const metadata = (auth.user?.user_metadata ?? {}) as Record<string, unknown>;
        setData({ email: auth.user?.email ?? "", phone: auth.user?.phone ?? "", fullName: String(metadata.full_name ?? kyc?.identity.fullName ?? ""), citizenId: kyc?.identity.citizenId ?? "", dateOfBirth: kyc?.identity.dateOfBirth ?? String(metadata.date_of_birth ?? ""), gender: kyc?.identity.gender ?? String(metadata.gender ?? ""), address: kyc?.identity.address ?? "", status: kyc?.kycStatus ?? "Chưa xác minh" });
      } catch { setError("Không thể tải thông tin cá nhân."); }
    })();
  }, []);
  const fields = data ? [["Họ và tên", data.fullName], ["Email", data.email], ["Số điện thoại", data.phone], ["Số CCCD", maskIdentity(data.citizenId)], ["Ngày sinh", data.dateOfBirth], ["Giới tính", data.gender], ["Địa chỉ trên CCCD", data.address]] : [];
  return (
    <AccountPage activeHref="/account/personal">
      <Panel className="min-h-[574px] px-5 py-6 sm:px-[30px]">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--ink)]">Thông tin cá nhân</h1>
            <p className="mt-1 text-xs text-[var(--muted)]">Thông tin định danh lấy từ tài khoản và kết quả eKYC</p>
          </div>
          {data ? <span className="ml-auto rounded border border-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent)]">{data.status === "VERIFIED" ? "Đã xác minh" : data.status}</span> : null}
        </div>
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <Feedback error={error} />
          {!data && !error ? <EmptyText>Đang tải thông tin...</EmptyText> : fields.map(([label, value]) => (
            <div className="flex min-h-12 flex-col gap-1 border-b border-[var(--line)] py-3 text-sm sm:flex-row sm:items-start sm:gap-4" key={label}>
              <span className="text-[var(--muted)] sm:w-[170px] sm:shrink-0">{label}</span>
              <span className="break-words">{value || "Chưa cập nhật"}</span>
            </div>
          ))}
        </div>
      </Panel>
    </AccountPage>
  );
}

export function PurchaseOrders() {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => { void api.listCommerceOrders().then(setOrders).catch(() => setError("Không thể tải đơn mua.")).finally(() => setLoading(false)); }, []);
  return (
    <AccountPage activeHref="/account/orders">
      <Panel className="min-h-[574px] px-5 py-6 sm:px-[30px]">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Đơn mua</h1>
        <div className="mt-3 border-t border-[var(--line)] pt-5">
          <Feedback error={error} />
          {loading ? <EmptyText>Đang tải đơn hàng...</EmptyText> : orders.length === 0 ? <EmptyState title="Bạn chưa có đơn mua" description={"Đơn hàng hoàn tất thanh toán sẽ xuất hiện tại\u00A0đây."} /> : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link className="block rounded-lg border border-[var(--line)] p-4 hover:border-[var(--accent)]" href={`/account/orders/${order.id}`} key={order.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{order.id}</strong>
                    <span className="ml-auto text-xs font-semibold text-[var(--accent)]">{orderStatusLabels[order.status]}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <p className="text-sm text-[var(--muted)]">1 kiện · {new Date(order.createdAt).toLocaleDateString("vi-VN")}</p>
                    <strong className="ml-auto tabular-nums text-[var(--accent)]">{order.totalVnd.toLocaleString("vi-VN")} ₫</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </AccountPage>
  );
}

function EmptyState({ description, title }: { description?: string; title: string }) {
  return (
    <div className="grid min-h-[320px] place-items-center text-center">
      <div>
        <h2 className="text-lg font-medium text-[var(--ink)]">{title}</h2>
        {description ? <p className="mt-2 text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
    </div>
  );
}

function FormField({ children, label }: { children: ReactNode; label: string }) {
  return <label className="mb-4 flex items-center gap-4 text-sm max-sm:block"><span className="w-36 shrink-0 text-right text-[var(--muted)] max-sm:mb-1 max-sm:block max-sm:text-left">{label}</span><div className="min-w-0 flex-1">{children}</div></label>;
}

function maskIdentity(value: string): string {
  return value ? `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : "";
}
