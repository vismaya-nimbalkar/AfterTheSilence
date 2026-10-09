"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { feature } from "topojson-client";
import world from "world-atlas/countries-50m.json";
import { getTravelMapId, getTravelMapIds, TRAVEL_STATUS_OPTIONS } from "@/src/lib/travel";
import RichTextEditor from "@/src/components/Admin/RichTextEditor";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";

function notesToEditorValue(notes) {
  if (!notes) return "";

  try {
    const parsed = JSON.parse(notes);
    if (parsed?.document?.type === "doc" || parsed?.type === "doc") return notes;
  } catch {}

  return JSON.stringify({
    document: {
      type: "doc",
      content: String(notes).split(/\n+/).filter(Boolean).map((text) => ({
        type: "paragraph",
        content: [{ type: "text", text }],
      })),
    },
    footnotes: [],
  });
}

const countryOptions = feature(world, world.objects.countries).features
  .map((country) => ({
    id: getTravelMapId(country),
    legacyIds: getTravelMapIds(country),
    name: country.properties.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const emptyCountry = {
  country_name: "",
  map_id: "",
  country_code: "",
  status: "caution",
  notes: "",
  advisories: [],
  published: false,
  last_edited_at: "",
};

export default function TravelAdminPage() {
  const router = useRouter();
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState(emptyCountry);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [draggedAdvisoryIndex, setDraggedAdvisoryIndex] = useState(null);
  const [dragOverAdvisoryIndex, setDragOverAdvisoryIndex] = useState(null);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [updatingFeature, setUpdatingFeature] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const loadCountries = async () => {
    const response = await fetch("/api/admin/travel", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load travel countries.");
    setCountries(result.countries || []);
    setFeatureEnabled(result.featureEnabled !== false);
  };

  useEffect(() => {
    loadCountries().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const chooseCountry = (value) => {
    const country = countryOptions.find((item) => item.id === value);
    setForm((current) => ({ ...current, country_name: country?.name || "", map_id: value }));
    setCountryMenuOpen(false);
  };

  const availableCountries = countryOptions.filter((country) =>
    !countries.some((existing) =>
      country.legacyIds.includes(existing.map_id) && existing.id !== editingId
    )
  );

  const selectedCountry = countryOptions.find((country) =>
    country.legacyIds.includes(form.map_id)
  );

  const addAdvisory = () => updateForm("advisories", [...form.advisories, { title: "", url: "" }]);
  const updateAdvisory = (index, field, value) => updateForm("advisories", form.advisories.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const removeAdvisory = (index) => updateForm("advisories", form.advisories.filter((_, itemIndex) => itemIndex !== index));

  const moveAdvisory = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= form.advisories.length) return;

    const reordered = [...form.advisories];
    const [movedAdvisory] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedAdvisory);
    updateForm("advisories", reordered);
  };

  const dropAdvisory = (event, targetIndex) => {
    event.preventDefault();

    if (draggedAdvisoryIndex === null || draggedAdvisoryIndex === targetIndex) {
      setDraggedAdvisoryIndex(null);
      setDragOverAdvisoryIndex(null);
      return;
    }

    moveAdvisory(draggedAdvisoryIndex, targetIndex);
    setDraggedAdvisoryIndex(null);
    setDragOverAdvisoryIndex(null);
  };

  const resetForm = () => {
    setForm(emptyCountry);
    setEditingId(null);
    setCountryMenuOpen(false);
  };

  const saveCountry = async (event, publish) => {
    event.preventDefault();
    setSaving(publish ? "publish" : "draft");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/travel", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form, save_as_draft: !publish } : { ...form, save_as_draft: !publish }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save travel country.");
      await loadCountries();
      setMessage(publish ? "Travel advisory published." : "Travel advisory saved as a draft.");
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const editCountry = (country) => {
    const draft = country.draft && typeof country.draft === "object" ? country.draft : null;
    setEditingId(country.id);
    const editableCountry = draft ? { ...country, ...draft, published: country.published } : country;
    setForm({ ...emptyCountry, ...editableCountry, notes: notesToEditorValue(editableCountry.notes), advisories: editableCountry.advisories || [] });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCountry = async (country) => {
    if (!await confirm({
      title: "Delete travel advisory?",
      message: `The advisory for ${country.country_name} will be permanently deleted.`,
      confirmLabel: "Delete advisory",
    })) return;
    const response = await fetch("/api/admin/travel", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: country.id }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not delete travel country.");
      return;
    }
    setCountries((current) => current.filter((item) => item.id !== country.id));
    if (editingId === country.id) resetForm();
    setMessage("Travel country deleted.");
  };

  const toggleFeature = async () => {
    setUpdatingFeature(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/travel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !featureEnabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update travel visibility.");
      setFeatureEnabled(result.featureEnabled !== false);
      setMessage(result.featureEnabled ? "Travel is now visible on the public website." : "Travel is now hidden from the public website.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingFeature(false);
    }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center"><p className="opacity-60">Loading travel management...</p></main>;

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">{dialog}
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => router.push("/admin")} className="text-sm opacity-60 hover:opacity-100">Back to Dashboard</button>
        <h1 className="mt-8 text-4xl font-bold">Travel advisories</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-60">Set the map status, add your notes, and link as many official government advisories as you need.</p>

        <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-dark/15 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Public Travel feature</p>
            <p className="mt-1 text-sm opacity-60">{featureEnabled ? "Visible in the header and available at /travel." : "Hidden from the header and blocked at /travel."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!featureEnabled && <a href="/admin-travel-preview" target="_blank" rel="noreferrer" className="rounded-lg border border-dark px-4 py-2 text-sm font-medium hover:opacity-70">Preview Travel</a>}
            <button type="button" onClick={toggleFeature} disabled={updatingFeature} className={`rounded-lg px-4 py-2 text-sm font-medium text-light transition-opacity hover:opacity-80 disabled:opacity-50 ${featureEnabled ? "bg-red-600" : "bg-green-700"}`}>
              {updatingFeature ? "Updating..." : featureEnabled ? "Turn Travel off" : "Turn Travel on"}
            </button>
          </div>
        </section>

        {error && <div className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">{error}</div>}
        {message && <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-700">{message}</div>}

        <form onSubmit={(event) => saveCountry(event, true)} className="mt-10 rounded-2xl border border-dark/20 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">{editingId ? "Edit country" : "Add a country"}</h2>
            {editingId && <button type="button" onClick={resetForm} className="text-sm opacity-60 hover:opacity-100">Cancel edit</button>}
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="relative text-sm font-medium">
              <span>Country</span>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={countryMenuOpen}
                onClick={() => setCountryMenuOpen((open) => !open)}
                className="mt-2 flex w-full items-center justify-between rounded-lg border border-dark/20 bg-transparent px-4 py-3 text-left font-normal hover:border-dark/50"
              >
                <span className={selectedCountry ? "" : "opacity-50"}>
                  {selectedCountry?.name || "Choose a country"}
                </span>
                <span aria-hidden="true" className="ml-4 text-xs">{countryMenuOpen ? "▲" : "▼"}</span>
              </button>
              {countryMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Countries"
                  className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-dark/20 bg-light p-2 shadow-xl dark:bg-dark"
                >
                  {availableCountries.length ? availableCountries.map((country) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={form.map_id === country.id}
                      key={country.id}
                      onClick={() => chooseCountry(country.id)}
                      className="block w-full rounded-lg px-3 py-2 text-left font-normal hover:bg-dark/10 dark:hover:bg-light/10"
                    >
                      {country.name}
                    </button>
                  )) : (
                    <p className="px-3 py-2 text-sm font-normal opacity-60">All countries already have advisories.</p>
                  )}
                </div>
              )}
              <input type="hidden" name="country" value={form.map_id} required />
            </div>
            <label className="text-sm font-medium">Two-letter country code
              <input value={form.country_code} onChange={(event) => updateForm("country_code", event.target.value.toLowerCase())} maxLength={2} placeholder="us" required className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
            </label>
            <label className="text-sm font-medium">Map status
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3">
                {TRAVEL_STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Last edited date
              <input type="date" value={form.last_edited_at || ""} onChange={(event) => updateForm("last_edited_at", event.target.value)} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              <span className="mt-2 block text-xs font-normal opacity-60">Shown publicly on the travel advisory.</span>
            </label>
            <div className="self-end pb-3 text-sm opacity-60">{editingId && form.published ? "Published advisory: draft changes stay private until published." : "Drafts stay hidden until published."}</div>
          </div>
          <div className="mt-5 text-sm font-medium">
            <span>Your notes</span>
            <div className="mt-2">
              <RichTextEditor value={form.notes} onChange={(value) => updateForm("notes", value)} />
            </div>
          </div>
          <div className="mt-7">
            <div className="flex items-center justify-between gap-4"><h3 className="text-lg font-semibold">Government advisories</h3><button type="button" onClick={addAdvisory} className="rounded-lg border border-dark px-4 py-2 text-sm font-medium hover:opacity-70">+ Add link</button></div>
            <div className="mt-4 space-y-3">
              {form.advisories.map((advisory, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                    setDraggedAdvisoryIndex(index);
                  }}
                  onDragEnter={() => setDragOverAdvisoryIndex(index)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverAdvisoryIndex(index);
                  }}
                  onDrop={(event) => dropAdvisory(event, index)}
                  onDragEnd={() => {
                    setDraggedAdvisoryIndex(null);
                    setDragOverAdvisoryIndex(null);
                  }}
                  className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[auto_1fr_1.4fr_auto] ${draggedAdvisoryIndex === index ? "border-dark/30 opacity-40" : dragOverAdvisoryIndex === index ? "border-dark/60 bg-dark/5" : "border-dark/10"}`}
                >
                  <div className="flex items-center gap-2 md:flex-col md:justify-center">
                    <span className="cursor-grab px-1 text-lg opacity-50" title="Drag to reorder" aria-label={`Drag advisory ${index + 1} to reorder`}>⋮⋮</span>
                    <span className="text-xs font-semibold opacity-50">{index + 1}</span>
                  </div>
                  <input value={advisory.title} onChange={(event) => updateAdvisory(index, "title", event.target.value)} placeholder="Advisory name" className="rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
                  <input type="url" value={advisory.url} onChange={(event) => updateAdvisory(index, "url", event.target.value)} placeholder="https://..." className="rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
                  <div className="flex items-center gap-2 md:flex-col md:justify-center">
                    <button type="button" onClick={() => moveAdvisory(index, index - 1)} disabled={index === 0} className="text-xs opacity-60 hover:opacity-100 disabled:opacity-20" title="Move up" aria-label="Move advisory up">↑</button>
                    <button type="button" onClick={() => moveAdvisory(index, index + 1)} disabled={index === form.advisories.length - 1} className="text-xs opacity-60 hover:opacity-100 disabled:opacity-20" title="Move down" aria-label="Move advisory down">↓</button>
                    <button type="button" onClick={() => removeAdvisory(index)} className="px-2 text-sm text-red-600 hover:opacity-70">Remove</button>
                  </div>
                </div>
              ))}
              {!form.advisories.length && <p className="text-sm opacity-60">No links added yet.</p>}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" disabled={saving !== null} onClick={(event) => saveCountry(event, false)} className="rounded-lg border border-dark px-6 py-3 font-medium transition-opacity hover:opacity-70 disabled:opacity-50">{saving === "draft" ? "Saving draft..." : "Save draft"}</button>
            <button type="submit" disabled={saving !== null} className="rounded-lg bg-dark px-6 py-3 font-medium text-light transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-light dark:text-dark">{saving === "publish" ? "Publishing..." : "Publish advisory"}</button>
          </div>
        </form>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Countries on the map</h2>
          <div className="mt-5 space-y-3">{countries.length ? countries.map((country) => <div key={country.id} className="flex flex-col gap-4 rounded-xl border border-dark/15 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{country.country_name}</p><p className="mt-1 text-sm opacity-60">{country.status} · {country.published ? "Published" : "Hidden"} · {country.advisories?.length || 0} advisory links</p></div><div className="flex gap-4 text-sm"><button type="button" onClick={() => editCountry(country)} className="font-medium hover:opacity-60">Edit</button><button type="button" onClick={() => deleteCountry(country)} className="text-red-600 hover:opacity-60">Delete</button></div></div>) : <p className="rounded-xl border border-dashed border-dark/20 p-6 text-sm opacity-60">No countries configured yet.</p>}</div>
        </section>
      </div>
    </main>
  );
}