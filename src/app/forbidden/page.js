export default function ForbiddenPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">

        <p className="text-7xl font-bold">
          403
        </p>

        <h1 className="mt-6 text-3xl font-bold">
          Forbidden
        </h1>

        <p className="mt-3 text-sm leading-6 opacity-60">
          You do not have permission to access
          this area of After The Silence.
        </p>

        <a
          href="/"
          className="
            mt-8
            inline-block
            rounded-lg
            bg-dark
            px-5
            py-3
            font-medium
            text-light
            transition-opacity
            hover:opacity-80
          "
        >
          ← Return to After The Silence
        </a>

      </div>
    </main>
  );
}