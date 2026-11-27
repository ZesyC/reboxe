"use client";

import { useState } from "react";
import { ProductVisual } from "./commerce-ui";

type GalleryImage = {
  key: string;
  url: string;
};

export function ListingGallery({
  images,
  title,
  fallbackLabel
}: {
  images: GalleryImage[];
  title: string;
  fallbackLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <ProductVisual
        className="h-[320px] w-full rounded-[10px] bg-[linear-gradient(139deg,var(--accent-strong)_14%,#7ea8df_86%)] sm:h-[430px]"
        label={fallbackLabel}
        labelClassName="text-3xl sm:text-[44px]"
      />
    );
  }

  return (
    <div className="min-w-0">
      <img
        alt={`${title} — ảnh ${activeIndex + 1}`}
        className="h-[320px] w-full rounded-[10px] bg-[var(--paper)] object-contain sm:h-[430px]"
        decoding="async"
        src={active.url}
      />
      {images.length > 1 ? (
        <div aria-label="Ảnh các sản phẩm trong kiện" className="mt-3 flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={`Xem ảnh ${index + 1} của ${title}`}
              className={`relative size-16 shrink-0 overflow-hidden rounded-lg border bg-[var(--paper)] transition sm:size-20 ${
                index === activeIndex
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                  : "border-[var(--line)] opacity-80 hover:opacity-100"
              }`}
              key={image.key}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <img
                alt=""
                className="size-full object-cover"
                decoding="async"
                loading="lazy"
                src={image.url}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
