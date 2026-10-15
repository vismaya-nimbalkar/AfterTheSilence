"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackLink from "@/src/components/BackLink";
import TravelCountryForm from "@/src/components/Admin/TravelCountryForm";

export default function EditTravelAdvisoryPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [country, setCountry] = useState(null);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCountry = async () => {
      try {
        const response = await fetch("/api/admin/travel", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load travel advisory.");

        const matchingCountry = (result.countries || []).find((item) => item.id === id);
        if (!matchingCountry) throw new Error("Travel advisory not found.");

        if (active) {
          setCountries(result.countries || []);
          setCountry(matchingCountry);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load travel advisory.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadCountry();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><p className="opacity-60">Loading travel advisory...</p></main>;
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <BackLink href="/admin/travel">Back to Travel advisories</BackLink>
        <h1 className="mt-8 text-4xl font-bold">Edit travel advisory</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-60">Changes to published advisories stay private until published.</p>
        {error ? (
          <div role="alert" className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">{error}</div>
        ) : country && (
          <TravelCountryForm
            country={country}
            countries={countries}
            onSaved={() => {
              window.dispatchEvent(new Event("travel-advisories-updated"));
              router.push("/admin/travel");
            }}
          />
        )}
      </div>
    </main>
  );
}
