import TravelMap from "@/src/components/TravelMap";

export default function TravelPageContent({ countries }) {
  return (
    <main className="min-h-screen px-6 pb-24 pt-12 sm:px-10 sm:pt-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] opacity-50">Travel</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-6xl">Know before you go.</h1>
          <p className="mt-5 text-base leading-7 opacity-70">Explore country-by-country travel information, government advisories, and notes from After The Silence.</p>
        </div>
        <TravelMap travelCountries={countries || []} />
      </div>
    </main>
  );
}
