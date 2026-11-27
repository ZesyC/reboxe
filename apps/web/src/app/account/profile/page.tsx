"use client";

import { ApiClientError } from "@reboxe/api-client";
import Image from "next/image";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AccountShell } from "../../../features/account-shell";
import { createBrowserApiClient } from "../../../platform/api/browser";
import { getSupabaseBrowserClient } from "../../../platform/auth/browser";

const api = createBrowserApiClient();

type ProfileData = {
  username: string;
  email: string;
  phone: string;
  fullName: string;
  gender: string;
  birthday: string;
  avatarUrl: string;
};

const emptyProfile: ProfileData = {
  username: "Tài khoản",
  email: "",
  phone: "",
  fullName: "",
  gender: "",
  birthday: "",
  avatarUrl: ""
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [avatarFile, setAvatarFile] = useState<File>();
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = getSupabaseBrowserClient();
        const [{ data, error: authError }, actor] = await Promise.all([supabase.auth.getUser(), api.getMe()]);
        if (authError || !data.user) throw authError ?? new Error("Unauthenticated");
        const ownerShop = actor.shops.find((shop) => shop.role === "OWNER" && shop.membershipStatus === "ACTIVE");
        const kyc = ownerShop?.kycId ? await api.getKycStatus(ownerShop.kycId) : undefined;
        const metadata = data.user.user_metadata as Record<string, unknown>;
        const email = data.user.email ?? "";
        const username = email.split("@")[0] || "Tài khoản";
        setProfile({
          username,
          email,
          phone: data.user.phone || metadataString(metadata, "phone"),
          fullName: metadataString(metadata, "full_name") || kyc?.identity.fullName || username,
          gender: metadataString(metadata, "gender") || kyc?.identity.gender || "",
          birthday: metadataString(metadata, "date_of_birth") || kyc?.identity.dateOfBirth || "",
          avatarUrl: metadataString(metadata, "avatar_url")
        });
      } catch (caught) {
        setError(caught instanceof ApiClientError && caught.status === 401
          ? "Bạn cần đăng nhập để xem hồ sơ."
          : "Không thể tải hồ sơ từ cơ sở dữ liệu.");
      } finally {
        setLoading(false);
      }
    }
    void loadProfile();
  }, []);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const supabase = getSupabaseBrowserClient();
      let avatarUrl = profile.avatarUrl;
      if (avatarFile) {
        const key = await api.uploadSellerDocument("AVATAR", avatarFile);
        avatarUrl = supabase.storage.from("catalog-media").getPublicUrl(key).data.publicUrl;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.fullName.trim(),
          gender: profile.gender,
          date_of_birth: profile.birthday,
          avatar_url: avatarUrl
        }
      });
      if (updateError) throw updateError;
      setProfile((current) => ({ ...current, avatarUrl }));
      setAvatarFile(undefined);
      setNotice("Đã lưu hồ sơ.");
    } catch {
      setError("Không thể lưu hồ sơ. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  function selectAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 1024 * 1024) {
      setError("Ảnh phải là JPEG hoặc PNG và không quá 1 MB.");
      return;
    }
    setError(undefined);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  const initials = profileInitials(profile.fullName || profile.username);

  return (
    <AccountShell activeHref="/account/profile" initials={initials} username={profile.username}>
      <section className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-5 py-6 sm:px-[30px]">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Hồ sơ của tôi</h1>
        <div className="mt-3 h-px bg-[var(--line)]" />
        {loading ? <p className="mt-6 text-sm text-[var(--muted)]" role="status">Đang tải hồ sơ...</p> : (
          <form className="mt-5 grid gap-8 md:grid-cols-[1fr_220px] md:items-start" onSubmit={saveProfile}>
            <div className="flex flex-col items-center gap-3 border-b border-[var(--line)] pb-6 md:order-2 md:border-b-0 md:border-l md:pb-0 md:pl-6">
              <div className="relative grid size-[100px] place-items-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[26px] font-bold text-[var(--accent)]">
                {avatarPreview || profile.avatarUrl ? <Image alt="Ảnh đại diện" className="object-cover" fill sizes="100px" src={avatarPreview || profile.avatarUrl} unoptimized /> : initials}
              </div>
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-[var(--line-strong)] bg-white px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]">
                Chọn ảnh
                <input accept="image/jpeg,image/png" className="sr-only" type="file" onChange={(event) => selectAvatar(event.target.files?.[0])} />
              </label>
              <p className="text-center text-xs leading-5 text-[var(--muted)]">Dung lượng tối đa 1 MB<br />Định dạng: JPEG, PNG</p>
            </div>

            <div className="flex min-w-0 flex-col gap-3 text-sm md:order-1">
              {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-red-700" role="alert">{error}</p> : null}
              {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800" role="status">{notice}</p> : null}
              <ProfileRow label="Tên đăng nhập"><strong className="font-medium">{profile.username}</strong></ProfileRow>
              <ProfileRow label="Tên">
                <input
                  aria-label="Tên"
                  className="min-h-11 w-full max-w-[340px] rounded-md border border-[var(--line-strong)] bg-white px-3.5 text-sm"
                  maxLength={120}
                  onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))}
                  required
                  value={profile.fullName}
                />
              </ProfileRow>
              <ProfileRow label="Email"><span className="break-all text-[var(--accent)]">{profile.email || "Thêm"}</span></ProfileRow>
              <ProfileRow label="Số điện thoại"><span className="text-[var(--accent)]">{maskPhone(profile.phone) || "Chưa thêm"}</span></ProfileRow>
              <ProfileRow label="Giới tính">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {["Nam", "Nữ", "Khác"].map((gender) => (
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2" key={gender}>
                      <input
                        checked={profile.gender.toLocaleLowerCase("vi") === gender.toLocaleLowerCase("vi")}
                        className="size-4 accent-[var(--accent)]"
                        name="gender"
                        onChange={() => setProfile((current) => ({ ...current, gender }))}
                        type="radio"
                      />
                      {gender}
                    </label>
                  ))}
                </div>
              </ProfileRow>
              <ProfileRow label="Ngày sinh"><span className="text-[var(--accent)]">{profile.birthday || "Chưa thêm"}</span></ProfileRow>
              <div className="pt-2 sm:pl-[138px]">
                <button
                  className="min-h-11 rounded-md bg-[var(--accent)] px-6 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "LƯU…" : "LƯU"}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    </AccountShell>
  );
}

function ProfileRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1 sm:min-h-11 sm:flex-row sm:items-center sm:gap-[18px]">
      <span className="text-[var(--muted)] sm:w-[120px] sm:shrink-0 sm:text-right">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  return typeof metadata[key] === "string" ? metadata[key].trim() : "";
}

function maskPhone(phone: string): string {
  return phone ? `${"*".repeat(Math.max(0, phone.length - 2))}${phone.slice(-2)}` : "";
}

function profileInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : parts[0]?.slice(0, 2) || "US").toUpperCase();
}
