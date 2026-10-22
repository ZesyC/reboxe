"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

export function PackageScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | undefined>(undefined);
  const generation = useRef(0);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => () => { generation.current++; controls.current?.stop(); }, []);
  function stop() {
    generation.current++; controls.current?.stop(); controls.current = undefined; setActive(false);
  }
  async function start() {
    setError(undefined);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera cần kết nối HTTPS. Bạn có thể nhập mã vận đơn vào ô bên dưới."); return;
    }
    setActive(true);
    const attempt = ++generation.current;
    let detected = false;
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (attempt !== generation.current || !video.current) return;
      const reader = new BrowserMultiFormatReader();
      const scanner = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current,
        (result, _error, controller) => {
          if (!result || detected || attempt !== generation.current) return;
          const value = result.getText().trim();
          if (!value || value.length > 200) return;
          detected = true; controller.stop(); stop(); onCode(value);
        });
      if (attempt !== generation.current || detected) scanner.stop();
      else controls.current = scanner;
    } catch {
      if (attempt === generation.current) {
        stop(); setError("Không mở được camera. Hãy kiểm tra quyền camera hoặc nhập mã bằng tay.");
      }
    }
  }
  return <div className="mt-4 space-y-3">
    <button className="rounded-lg border border-[var(--accent)] px-4 py-2 font-bold text-[var(--accent)]" onClick={() => active ? stop() : void start()} type="button">{active ? "Dừng camera" : "Quét mã bằng camera"}</button>
    <video aria-label="Camera quét mã kiện" className={active ? "max-h-80 w-full rounded-lg bg-black object-contain" : "hidden"} muted playsInline ref={video} />
    {active ? <p className="text-sm">Đưa mã vạch vào giữa khung hình. Mã đọc được sẽ điền vào ô bên dưới để bạn kiểm tra.</p> : null}
    {error ? <p className="text-sm text-amber-800" role="status">{error}</p> : null}
  </div>;
}
