import Link from "next/link";

export default function BackLink({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-dark/15 px-3 py-1.5 text-sm font-medium text-dark/65 transition-colors hover:border-dark/30 hover:text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dark/40 dark:border-light/15 dark:text-light/65 dark:hover:border-light/30 dark:hover:text-light dark:focus-visible:ring-light/40"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7 7-7-7 7-7" />
      </svg>
      {children}
    </Link>
  );
}
