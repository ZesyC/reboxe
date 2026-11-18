import type { CSSProperties, ReactNode } from "react";

export function ReboxeBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] ${className}`}>
      {children}
    </span>
  );
}

export function ProductVisual({
  className = "",
  gradient,
  label,
  labelClassName = "",
  src
}: {
  className?: string;
  gradient?: string;
  label: string;
  labelClassName?: string;
  src?: string | undefined;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg text-white ${className}`}
      style={gradient ? ({ backgroundImage: gradient } as CSSProperties) : undefined}
    >
      {src ? (
        <img alt={label} className="size-full object-cover" decoding="async" loading="lazy" src={src} />
      ) : (
        <strong className={`font-bold leading-5 ${labelClassName}`}>{label}</strong>
      )}
    </div>
  );
}
