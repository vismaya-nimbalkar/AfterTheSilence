export default function LoadingScreen() {
  return (
    <main
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-light text-dark dark:bg-dark dark:text-light"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 text-sm opacity-70">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
        <span>Loading...</span>
      </div>
    </main>
  );
}