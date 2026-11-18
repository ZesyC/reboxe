"use client";

import { ApiClientError } from "@reboxe/api-client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { getSupabaseBrowserClient } from "../platform/auth/browser";

const api = createBrowserApiClient();
const steps = ["Điều kiện", "Hồ sơ shop", "Kho lấy hàng", "eKYC", "Vận chuyển"];
type CarrierCode = "GHN" | "GHTK";

type OnboardingForm = {
  phone: string;
  displayName: string;
  description: string;
  contactName: string;
  addressLine: string;
  province: string;
  district: string;
  ward: string;
  taxCode: string;
  bankCode: string;
  bankAccount: string;
  accountHolder: string;
  carrierCodes: CarrierCode[];
};

const initialForm: OnboardingForm = {
  phone: "",
  displayName: "",
  description: "",
  contactName: "",
  addressLine: "",
  province: "",
  district: "",
  ward: "",
  taxCode: "",
  bankCode: "",
  bankAccount: "",
  accountHolder: "",
  carrierCodes: ["GHN", "GHTK"]
};

export function SellerOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File>();
  const [cccdFrontFile, setCccdFrontFile] = useState<File>();
  const [cccdBackFile, setCccdBackFile] = useState<File>();
  const [selfieFile, setSelfieFile] = useState<File>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [createdShopId, setCreatedShopId] = useState<string>();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    async function loadAccount() {
      const result = await supabase.auth.getUser();
      const data = result.data;
      const authError = result.error;
      if (authError || !data.user) {
        router.replace("/login?next=/seller/onboarding");
        return;
      }
      setEmail(data.user.email ?? "");
      setEmailVerified(Boolean(data.user.email_confirmed_at));
      try {
        const actor = await api.getMe();
        if (actor.shops.length > 0) {
          router.replace("/seller/inventory");
          return;
        }
        if (actor.profileStatus === "SUSPENDED" || actor.profileStatus === "DELETED") {
          setError("Tài khoản đang bị hạn chế và chưa thể đăng ký bán hàng.");
        }
        setLoading(false);
      } catch (caught) {
        setError(caught instanceof ApiClientError && caught.status === 401
          ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          : "Không thể kiểm tra trạng thái tài khoản.");
        setLoading(false);
      }
    }
    void loadAccount();
  }, [router]);

  function update<K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function continueTo(nextStep: number) {
    setError(undefined);
    setNotice(undefined);
    setStep(nextStep);
  }

  function selectDocument(file: File | undefined, setFile: (value: File | undefined) => void) {
    if (!file) return setFile(undefined);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Ảnh phải là JPEG, PNG hoặc WebP và không quá 5 MB.");
      return;
    }
    setError(undefined);
    setFile(file);
  }

  async function resendConfirmation() {
    if (!email) return;
    setError(undefined);
    const { error: resendError } = await getSupabaseBrowserClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login?next=/seller/onboarding` }
    });
    if (resendError) setError("Chưa thể gửi lại email xác nhận. Vui lòng thử lại sau.");
    else setNotice("Đã gửi lại email xác nhận.");
  }

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!avatarFile || !cccdFrontFile || !cccdBackFile || !selfieFile) {
      setError("Hãy chọn đủ ảnh đại diện, hai mặt CCCD và ảnh selfie.");
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      // ponytail: pre-submit files can be orphaned; add scheduled cleanup when upload volume warrants it.
      const [avatarKey, cccdFrontKey, cccdBackKey, selfieKey] = await Promise.all([
        api.uploadSellerDocument("AVATAR", avatarFile),
        api.uploadSellerDocument("CCCD_FRONT", cccdFrontFile),
        api.uploadSellerDocument("CCCD_BACK", cccdBackFile),
        api.uploadSellerDocument("SELFIE", selfieFile)
      ]);
      const shopId = createdShopId ?? (await api.createShop({
          displayName: form.displayName,
          legalType: "INDIVIDUAL",
          description: form.description,
          phone: form.phone,
          pickupAddress: {
            contactName: form.contactName,
            addressLine: form.addressLine,
            province: form.province,
            district: form.district,
            ward: form.ward
          },
          kyc: {
            taxCode: form.taxCode,
            bankCode: form.bankCode,
            bankAccount: form.bankAccount,
            accountHolder: form.accountHolder
          },
          documents: { avatarKey, cccdFrontKey, cccdBackKey },
          carrierCodes: form.carrierCodes
        })).shopId;
      setCreatedShopId(shopId);
      const kyc = await api.startKyc(shopId);
      await api.submitKycDocument("front", kyc.id, cccdFrontKey);
      await api.submitKycDocument("back", kyc.id, cccdBackKey);
      await api.submitKycSelfie(kyc.id, selfieKey);
      await api.submitKycTax(kyc.id, form.taxCode);
      await api.submitKycBank(kyc.id, form.bankCode, form.bankAccount);
      router.replace("/seller/inventory");
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.code === "SHOP_NAME_TAKEN"
        ? "Tên shop đã được sử dụng. Hãy chọn tên khác."
        : caught instanceof ApiClientError && caught.code === "EMAIL_NOT_VERIFIED"
          ? "Bạn cần xác nhận email trước khi tạo shop."
          : caught instanceof ApiClientError && caught.code === "KYC_PROVIDER_UNAVAILABLE"
            ? "Dịch vụ eKYC đang tạm thời gián đoạn. Hồ sơ đã được lưu để thử lại sau."
            : "Không thể hoàn tất đăng ký seller. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="mx-auto max-w-5xl px-5 py-20 text-center text-[var(--muted)]" role="status">Đang kiểm tra tài khoản...</p>;

  return (
    <main className="min-h-[calc(100vh-52px)] bg-[var(--paper)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-sm font-bold text-[var(--accent)]">Kênh Người Bán</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Đăng ký trở thành seller</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Tài khoản buyer vẫn được giữ nguyên. Shop chỉ được tạo sau khi hoàn thành bước cuối.</p>
        </div>

        <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Tiến trình đăng ký seller">
          {steps.map((label, index) => (
            <li
              aria-current={index === step ? "step" : undefined}
              className={`rounded-xl px-2.5 py-3 text-center text-xs font-bold ${index === step ? "bg-[var(--accent)] text-white" : index < step ? "bg-emerald-50 text-emerald-800" : "bg-white text-[var(--muted)]"}`}
              key={label}
            >
              <span className="block text-xs opacity-90">Bước {index + 1}</span>{label}
            </li>
          ))}
        </ol>

        <section className="rounded-[18px] border border-[var(--line)] bg-white p-6 shadow-[0_12px_35px_rgba(35,63,101,0.06)] sm:p-8">
          {error ? <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p> : null}
          {notice ? <p className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700" role="status">{notice}</p> : null}

          {step === 0 ? (
            <form onSubmit={(event) => { event.preventDefault(); continueTo(1); }}>
              <StepTitle number={1} title="Kiểm tra điều kiện tài khoản" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <StatusCard label="Email" value={email || "Chưa có email"} verified={emailVerified} />
                <StatusCard label="Trạng thái tài khoản" value="Đang hoạt động" verified />
              </div>
              {!emailVerified ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Bạn cần xác nhận email trước khi tiếp tục.
                  <button className="ml-2 font-bold underline" onClick={() => void resendConfirmation()} type="button">Gửi lại email</button>
                </div>
              ) : null}
              <Field label="Số điện thoại" className="mt-6">
                <input className={inputClass} inputMode="tel" maxLength={10} pattern="0[0-9]{9}" placeholder="0901234567" required value={form.phone} onChange={(event) => update("phone", event.target.value)} />
                <span className="text-xs font-normal text-[var(--muted)]">Bản test chỉ yêu cầu nhập, chưa gửi OTP.</span>
              </Field>
              <Actions nextDisabled={Boolean(error)} />
            </form>
          ) : null}

          {step === 1 ? (
            <form onSubmit={(event) => { event.preventDefault(); if (!avatarFile) { setError("Hãy chọn ảnh đại diện cho shop."); return; } continueTo(2); }}>
              <StepTitle number={2} title="Thiết lập hồ sơ cơ bản của shop" />
              <div className="mt-6 grid gap-5 sm:grid-cols-[140px_1fr]">
                <div>
                  <div className="relative mx-auto size-28 overflow-hidden rounded-2xl bg-[var(--accent-soft)]">
                    <Image alt="Ảnh đại diện shop mẫu" fill sizes="112px" src="/reboxe/seller-avatar.svg" />
                  </div>
                  <label className="mt-3 block text-center text-xs font-bold text-[var(--accent)]">
                    Chọn ảnh đại diện
                    <input accept="image/jpeg,image/png,image/webp" className="sr-only" required={!avatarFile} type="file" onChange={(event) => selectDocument(event.target.files?.[0], setAvatarFile)} />
                  </label>
                  {avatarFile ? <p className="mt-1 truncate text-center text-xs text-[var(--muted)]">{avatarFile.name}</p> : null}
                </div>
                <div className="grid gap-4">
                  <Field label="Tên shop">
                    <input className={inputClass} maxLength={120} minLength={2} placeholder="Ví dụ: REBOXE Store Hà Nội" required value={form.displayName} onChange={(event) => update("displayName", event.target.value)} />
                  </Field>
                  <Field label="Mô tả ngắn">
                    <textarea className={`${inputClass} min-h-24 resize-y`} maxLength={500} minLength={10} placeholder="Mô tả mặt hàng và khu vực hoạt động của shop" required value={form.description} onChange={(event) => update("description", event.target.value)} />
                  </Field>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">Ảnh được tải lên khi bạn hoàn tất đăng ký.</p>
              <Actions back={() => continueTo(0)} />
            </form>
          ) : null}

          {step === 2 ? (
            <form onSubmit={(event) => { event.preventDefault(); continueTo(3); }}>
              <StepTitle number={3} title="Địa chỉ kho lấy hàng" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Tên người liên hệ"><input className={inputClass} maxLength={120} minLength={2} required value={form.contactName} onChange={(event) => update("contactName", event.target.value)} /></Field>
                <Field label="Số điện thoại liên hệ"><input className={inputClass} readOnly value={form.phone} /></Field>
                <Field className="sm:col-span-2" label="Địa chỉ chi tiết"><input className={inputClass} maxLength={250} minLength={5} placeholder="Số nhà, tên đường" required value={form.addressLine} onChange={(event) => update("addressLine", event.target.value)} /></Field>
                <Field label="Tỉnh/Thành phố"><input className={inputClass} maxLength={100} minLength={2} required value={form.province} onChange={(event) => update("province", event.target.value)} /></Field>
                <Field label="Quận/Huyện"><input className={inputClass} maxLength={100} minLength={2} required value={form.district} onChange={(event) => update("district", event.target.value)} /></Field>
                <Field label="Phường/Xã"><input className={inputClass} maxLength={100} minLength={2} required value={form.ward} onChange={(event) => update("ward", event.target.value)} /></Field>
              </div>
              <Actions back={() => continueTo(1)} />
            </form>
          ) : null}

          {step === 3 ? (
            <form onSubmit={(event) => { event.preventDefault(); continueTo(4); }}>
              <StepTitle number={4} title="Định danh và thông tin thanh toán" />
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Ảnh CCCD và selfie được xử lý trong bucket private để OCR, đối chiếu khuôn mặt và kiểm tra liveness. <Link className="font-bold underline" href="/legal/processing-notice">Đọc thông báo xử lý dữ liệu</Link>.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <DocumentField file={cccdFrontFile} label="Mặt trước CCCD" onChange={(file) => selectDocument(file, setCccdFrontFile)} />
                <DocumentField file={cccdBackFile} label="Mặt sau CCCD" onChange={(file) => selectDocument(file, setCccdBackFile)} />
                <DocumentField capture="user" file={selfieFile} label="Ảnh selfie trực diện" onChange={(file) => selectDocument(file, setSelfieFile)} />
                <Field label="Mã số thuế cá nhân"><input className={inputClass} inputMode="numeric" maxLength={14} pattern="[0-9]{10}(-[0-9]{3})?" required value={form.taxCode} onChange={(event) => update("taxCode", event.target.value)} /></Field>
                <Field label="Ngân hàng"><input className={inputClass} maxLength={30} minLength={2} required value={form.bankCode} onChange={(event) => update("bankCode", event.target.value)} /></Field>
                <Field label="Số tài khoản"><input className={inputClass} maxLength={30} minLength={6} required value={form.bankAccount} onChange={(event) => update("bankAccount", event.target.value)} /></Field>
                <Field label="Tên chủ tài khoản"><input className={inputClass} maxLength={120} minLength={2} required value={form.accountHolder} onChange={(event) => update("accountHolder", event.target.value)} /></Field>
              </div>
              <Actions back={() => continueTo(2)} />
            </form>
          ) : null}

          {step === 4 ? (
            <form onSubmit={(event) => void finish(event)}>
              <StepTitle number={5} title="Cấu hình đơn vị vận chuyển" />
              <p className="mt-2 text-sm text-[var(--muted)]">Chọn ít nhất một đơn vị được phép lấy hàng tại kho.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(["GHN", "GHTK"] as const).map((carrier) => (
                  <label className="flex items-center justify-between rounded-xl border border-[var(--line)] p-5 font-bold" key={carrier}>
                    {carrier === "GHN" ? "Giao Hàng Nhanh" : "Giao Hàng Tiết Kiệm"}
                    <input checked={form.carrierCodes.includes(carrier)} className="size-5 accent-[var(--accent)]" type="checkbox" onChange={(event) => update("carrierCodes", event.target.checked ? [...form.carrierCodes, carrier] : form.carrierCodes.filter((code) => code !== carrier))} />
                  </label>
                ))}
              </div>
              {form.carrierCodes.length === 0 ? <p className="mt-3 text-sm text-red-700" role="alert">Hãy chọn ít nhất một đơn vị vận chuyển.</p> : null}
              <Actions back={() => continueTo(3)} finish disabled={form.carrierCodes.length === 0 || submitting} submitting={submitting} />
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}

const inputClass = "min-h-11 w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3 text-sm read-only:bg-slate-50";

function StepTitle({ number, title }: { number: number; title: string }) {
  return <div><p className="text-sm font-bold text-[var(--accent)]">Bước {number}/5</p><h2 className="mt-1 text-2xl font-black">{title}</h2></div>;
}

function Field({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  return <label className={`grid gap-2 text-sm font-bold ${className}`}>{label}{children}</label>;
}

function StatusCard({ label, value, verified }: { label: string; value: string; verified: boolean }) {
  return <div className="rounded-xl border border-[var(--line)] p-4"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 font-bold">{value}</p><p className={`mt-2 text-xs font-bold ${verified ? "text-emerald-700" : "text-amber-700"}`}>{verified ? "Đạt yêu cầu" : "Chưa xác nhận"}</p></div>;
}

function DocumentField({ capture, file, label, onChange }: { capture?: "user"; file: File | undefined; label: string; onChange: (file?: File) => void }) {
  return <label className="grid min-h-32 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[var(--line-strong)] bg-slate-50 p-4 text-center"><span><span className="block font-black">{label}</span><span className="mt-2 block text-xs text-[var(--accent)]">{file?.name ?? "Chọn ảnh JPEG, PNG hoặc WebP"}</span></span><input accept="image/jpeg,image/png,image/webp" capture={capture} className="sr-only" required={!file} type="file" onChange={(event) => onChange(event.target.files?.[0])} /></label>;
}

function Actions({ back, disabled = false, finish = false, nextDisabled = false, submitting = false }: { back?: () => void; disabled?: boolean; finish?: boolean; nextDisabled?: boolean; submitting?: boolean }) {
  return <div className="mt-8 flex items-center justify-between gap-3">{back ? <button className="rounded-xl border border-[var(--line-strong)] px-5 py-3 font-bold" onClick={back} type="button">Quay lại</button> : <span />}<button className="rounded-xl bg-[var(--accent)] px-6 py-3 font-bold text-white disabled:opacity-50" disabled={disabled || nextDisabled}>{submitting ? "Đang tạo shop..." : finish ? "Hoàn tất đăng ký" : "Tiếp tục"}</button></div>;
}
