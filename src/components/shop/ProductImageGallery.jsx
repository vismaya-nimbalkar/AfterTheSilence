"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProductImageGallery({
  images = [],
  title,
  linkHref,
}) {
  const availableImages = [
    ...new Set(images.filter((image) => typeof image === "string" && image)),
  ];
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [images]);

  const mainImage = availableImages[selectedIndex];
  const showPrevious = () => {
    setSelectedIndex((index) =>
      index === 0 ? availableImages.length - 1 : index - 1,
    );
  };
  const showNext = () => {
    setSelectedIndex((index) => (index + 1) % availableImages.length);
  };

  const image = mainImage ? (
    <img
      src={mainImage}
      alt={title}
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-xs opacity-40">
      No Image
    </div>
  );

  return (
    <div>
      <div className="group/gallery relative aspect-square overflow-hidden rounded-xl border border-dark/10 bg-dark/5 dark:border-light/10 dark:bg-light/5">
        {linkHref ? (
          <Link href={linkHref} aria-label={`View ${title}`} className="block h-full w-full">
            {image}
          </Link>
        ) : image}
        {availableImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label={`Previous image for ${title}`}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-dark shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-dark dark:bg-zinc-900/90 dark:text-light dark:hover:bg-zinc-900"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label={`Next image for ${title}`}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-dark shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-dark dark:bg-zinc-900/90 dark:text-light dark:hover:bg-zinc-900"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {selectedIndex + 1} / {availableImages.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
