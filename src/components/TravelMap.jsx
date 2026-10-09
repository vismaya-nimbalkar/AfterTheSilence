"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { feature } from "topojson-client";
import world from "world-atlas/countries-50m.json";
import { getTravelMapId, getTravelMapIds, getTravelStatus } from "@/src/lib/travel";

const countries = feature(world, world.objects.countries);
const searchableCountries = countries.features;

function renderNotes(notes) {
  if (!notes) return null;

  try {
    const parsed = JSON.parse(notes);
    const document = parsed?.document?.type === "doc" ? parsed.document : parsed;
    if (document?.type === "doc") {
      return {
        html: generateHTML(document, [
          StarterKit,
          Underline,
          Highlight,
          Link.configure({ openOnClick: false }),
        ]),
      };
    }
  } catch {}

  return { text: notes };
}

const NO_ADVISORY_STATUS = {
  label: "No advisory set",
  color: "#ffffff",
  textColor: "#3c3b3d",
};

export default function TravelMap({ travelCountries = [] }) {
  const [indiaGeoJson, setIndiaGeoJson] = useState(null);

  // Load custom official India border from public folder
  useEffect(() => {
    fetch("/india.geojson")
      .then((res) => res.json())
      .then((data) => setIndiaGeoJson(data))
      .catch((err) => console.error("Error loading india.geojson:", err));
  }, []);

  const countryByMapId = useMemo(() => {
    const lookup = new Map();
    countries.features.forEach((geography) => {
      const country = travelCountries.find((item) =>
        getTravelMapIds(geography).includes(String(item.map_id))
      );
      if (country) lookup.set(getTravelMapId(geography), country);
    });
    return lookup;
  }, [travelCountries]);

  const [selected, setSelected] = useState(travelCountries[0] || null);
  const [selectedMapId, setSelectedMapId] = useState(travelCountries[0]?.map_id || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const advisoryRef = useRef(null);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return searchableCountries
      .filter((geography) => geography.properties.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchQuery]);

  const selectCountry = (geography) => {
    const country = countryByMapId.get(getTravelMapId(geography));
    setSelectedMapId(getTravelMapId(geography));
    setSelected(
      country || {
        country_name: geography.properties.name || "India",
        country_code: "",
        status: null,
        notes: "No advisory set.",
        advisories: [],
      }
    );
  };

  const selectSearchResult = (geography) => {
    selectCountry(geography);
    setSearchQuery(geography.properties.name);
    setSearchOpen(false);
    requestAnimationFrame(() => advisoryRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const status = selected?.status ? getTravelStatus(selected.status) : NO_ADVISORY_STATUS;
  const renderedNotes = renderNotes(selected?.notes);
  const lastEditedDate =
    selected?.last_edited_at || selected?.updated_at
      ? String(selected.last_edited_at || selected.updated_at).slice(0, 10)
      : "";

  return (
    <>
      <div className="relative mb-6 max-w-xl">
        <label htmlFor="travel-country-search" className="sr-only">
          Search for a country
        </label>
        <input
          id="travel-country-search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && searchResults[0]) {
              event.preventDefault();
              selectSearchResult(searchResults[0]);
            }
            if (event.key === "Escape") setSearchOpen(false);
          }}
          placeholder="Search for a country"
          className="w-full rounded-xl border border-dark/20 bg-transparent px-4 py-3 pr-12 outline-none transition-colors focus:border-dark/60"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-50"
        >
          ⌕
        </span>
        {searchOpen && searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-dark/20 bg-light p-2 shadow-xl dark:bg-dark">
            {searchResults.length ? (
              searchResults.map((geography) => (
                <button
                  key={getTravelMapId(geography)}
                  type="button"
                  onClick={() => selectSearchResult(geography)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-dark/10 dark:hover:bg-light/10"
                >
                  {geography.properties.name}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm opacity-60">No country found.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-fit overflow-hidden rounded-3xl border border-dark/15 bg-white dark:bg-white">
          <div className="flex items-center justify-between border-b border-dark/10 px-5 py-4 text-sm">
            <span className="font-medium">Political map</span>
            <span className="text-xs opacity-50">Pinch to zoom</span>
          </div>
          <ComposableMap
            width={1000}
            height={560}
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 180, center: [0, 15] }}
            className="h-auto w-full"
            style={{ touchAction: "none", backgroundColor: "#ffffff", willChange: "transform" }}
          >
            <ZoomableGroup
              center={[0, 15]}
              zoom={1}
              minZoom={1}
              maxZoom={6}
              translateExtent={[
                [0, 0],
                [1000, 560],
              ]}
              filterZoomEvent={(event) =>
                event.type === "wheel" ? event.ctrlKey : !event.button
              }
            >
              {/* World Map Base Layer */}
              <Geographies geography={countries}>
                {({ geographies }) =>
                  geographies.map((geography) => {
                    const isIndia = geography.properties.name === "India";
                    const country = countryByMapId.get(getTravelMapId(geography));
                    const isSelected = selectedMapId === getTravelMapId(geography);
                    const fill = country?.status
                      ? getTravelStatus(country.status).color
                      : "#ffffff";

                    return (
                      <Geography
                        key={geography.rsmKey}
                        geography={geography}
                        fill={fill}
                        // Hide stroke on default India so custom border overlays cleanly
                        stroke={isIndia ? "none" : isSelected ? "#173f38" : "#000000"}
                        strokeWidth={isSelected ? 1.5 : 0.8}
                        strokeOpacity={1}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        onClick={() => selectCountry(geography)}
                        style={{
                          default: {
                            fill,
                            outline: "none",
                            stroke: isIndia ? "none" : isSelected ? "#173f38" : "#000000",
                            strokeWidth: isSelected ? 1.5 : 0.8,
                          },
                          hover: {
                            fill,
                            outline: "none",
                            cursor: "pointer",
                            stroke: "#173f38",
                            strokeWidth: 1.2,
                          },
                          pressed: {
                            fill: country?.status ? "#1f5f52" : "#f0f0f0",
                            outline: "none",
                          },
                        }}
                      />
                    );
                  })
                }
              </Geographies>

              {/* Custom Official India Border Overlay */}
              {indiaGeoJson && (
                <Geographies geography={indiaGeoJson}>
                  {({ geographies }) =>
                    geographies.map((geography) => {
                      const indiaCountry = travelCountries.find(
                        (item) => item.country_name === "India" || item.country_code === "in"
                      );
                      const isSelected = selectedMapId === "356" || selected?.country_name === "India";
                      const fill = indiaCountry?.status
                        ? getTravelStatus(indiaCountry.status).color
                        : "#ffffff";

                      return (
                        <Geography
                          key={`india-custom-${geography.rsmKey}`}
                          geography={geography}
                          fill={fill}
                          stroke={isSelected ? "#173f38" : "#000000"}
                          strokeWidth={isSelected ? 1.5 : 0.8}
                          strokeOpacity={1}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          onClick={() => selectCountry(geography)}
                          style={{
                            default: {
                              fill,
                              outline: "none",
                              stroke: isSelected ? "#173f38" : "#000000",
                              strokeWidth: isSelected ? 1.5 : 0.8,
                            },
                            hover: {
                              fill,
                              outline: "none",
                              cursor: "pointer",
                              stroke: "#173f38",
                              strokeWidth: 1.2,
                            },
                            pressed: {
                              fill: indiaCountry?.status ? "#1f5f52" : "#f0f0f0",
                              outline: "none",
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              )}
            </ZoomableGroup>
          </ComposableMap>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-dark/10 px-5 py-4 text-xs">
            {Object.entries({
              safe: "Safe",
              caution: "Increased caution",
              reconsider: "Reconsider",
              do_not_travel: "Do not travel",
            }).map(([key, label]) => (
              <span key={key} className="inline-flex items-center gap-2">
                <i
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getTravelStatus(key).color }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>

        <aside
          ref={advisoryRef}
          className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-3xl border border-dark/15 p-6"
        >
          {selected ? (
            <>
              <div className="flex items-start gap-4">
                {selected.country_code ? (
                  <img
                    src={`https://flagcdn.com/w160/${selected.country_code}.png`}
                    alt={`${selected.country_name} flag`}
                    className="h-12 w-20 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-20 rounded bg-dark/10" />
                )}
                <div>
                  <p className="text-sm opacity-60">Travel advisory</p>
                  <h2 className="mt-1 text-2xl font-semibold">{selected.country_name}</h2>
                </div>
              </div>
              <div
                className="mt-6 rounded-xl border border-dark/15 px-4 py-3 font-semibold"
                style={{ backgroundColor: status.color, color: status.textColor }}
              >
                {status.label}
              </div>
              {lastEditedDate && (
                <p className="mt-4 border-b border-dark/10 pb-4 text-sm font-medium opacity-70">
                  Last edited{" "}
                  {new Date(`${lastEditedDate}T12:00:00`).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {renderedNotes?.html ? (
                <div
                  className="prose prose-sm mt-6 max-w-none leading-7 opacity-80 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: renderedNotes.html }}
                />
              ) : (
                <p className="mt-6 whitespace-pre-wrap text-sm leading-7 opacity-80">
                  {renderedNotes?.text || "No additional notes have been published for this country."}
                </p>
              )}
              <div className="mt-7 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-50">
                  Government advisories
                </p>
                {selected.advisories?.length ? (
                  selected.advisories.map((advisory) => (
                    <a
                      key={`${advisory.title}-${advisory.url}`}
                      href={advisory.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-dark/20 px-4 py-3 text-sm font-medium hover:bg-dark hover:text-light dark:hover:bg-light dark:hover:text-dark"
                    >
                      {advisory.title} <span aria-hidden="true">↗</span>
                    </a>
                  ))
                ) : (
                  <p className="text-sm opacity-60">No government advisories linked yet.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm opacity-60">Select a country to view its advisory.</p>
          )}
        </aside>
      </div>
    </>
  );
}