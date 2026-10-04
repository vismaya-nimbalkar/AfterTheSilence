"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultQuestion, FORM_QUESTION_TYPES, slugify } from "@/src/lib/forms";

const emptyForm = {
  title: "",
  description: "",
  slug: "",
  status: "draft",
  settings: { collectEmail: false, limitOneResponse: false, sendResponseReceipt: false },
  confirmation_message: "Your response has been recorded.",
  confirmation_image_url: "",
  questions: [],
};

function CustomMenu({ value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg border border-dark/20 bg-transparent px-4 py-3 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "" : "opacity-60"}>
          {selected?.label || placeholder}
        </span>
        <span className={`text-sm transition-transform ${open ? "rotate-180" : ""}`}>
          v
        </span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-dark/20 bg-light shadow-xl dark:bg-dark"
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full px-4 py-3 text-left transition-colors hover:bg-dark/5 dark:hover:bg-light/10 ${
                option.value === value ? "font-semibold" : ""
              }`}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
];

export default function FormBuilder({ formId = null }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(Boolean(formId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState(null);
  const [uploadingQuestionIndex, setUploadingQuestionIndex] = useState(null);
  const [uploadingConfirmationImage, setUploadingConfirmationImage] = useState(false);

  useEffect(() => {
    if (!formId) return;

    fetch(`/api/admin/forms/${formId}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load form.");
        setForm({
          ...emptyForm,
          ...result.form,
          title: result.form.title === "Untitled form" ? "" : result.form.title,
          settings: { ...emptyForm.settings, ...(result.form.settings || {}) },
          questions: (result.form.form_questions || [])
            .sort((a, b) => a.position - b.position)
            .map((question) => ({
              ...question,
              required: Boolean(question.required),
              image_url: question.image_url || "",
              title: question.title === "Untitled question" ? "" : question.title,
              options: ["multiple_choice", "checkboxes", "dropdown"].includes(question.type)
                ? ((question.options || []).map((option, optionIndex) => option === `Option ${optionIndex + 1}` ? "" : option).length
                  ? (question.options || []).map((option, optionIndex) => option === `Option ${optionIndex + 1}` ? "" : option)
                  : [""])
                : [],
            })),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [formId]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSetting = (field, value) => {
    setForm((current) => ({
      ...current,
      settings: { ...current.settings, [field]: value },
    }));
  };

  const updateQuestion = (index, field, value) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [field]: value } : question
      ),
    }));
  };

  const uploadQuestionImage = async (index, file) => {
    if (!file) return;
    setUploadingQuestionIndex(index);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/forms/upload", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not upload image.");
      updateQuestion(index, "image_url", result.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingQuestionIndex(null);
    }
  };

  const uploadConfirmationImage = async (file) => {
    if (!file) return;
    setUploadingConfirmationImage(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/forms/upload", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not upload image.");
      update("confirmation_image_url", result.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingConfirmationImage(false);
    }
  };

  const addQuestion = () => {
    setForm((current) => ({
      ...current,
      questions: [...current.questions, defaultQuestion(current.questions.length)],
    }));
  };

  const removeQuestion = (index) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  };

  const moveQuestion = (fromIndex, toIndex) => {
    setForm((current) => {
      if (toIndex < 0 || toIndex >= current.questions.length) return current;
      const questions = [...current.questions];
      const [question] = questions.splice(fromIndex, 1);
      questions.splice(toIndex, 0, question);
      return { ...current, questions };
    });
  };

  const dropQuestion = (targetIndex) => {
    if (draggedQuestionIndex === null || draggedQuestionIndex === targetIndex) return;
    moveQuestion(draggedQuestionIndex, targetIndex);
    setDraggedQuestionIndex(null);
  };

  const handleQuestionDragStart = (event, index) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDraggedQuestionIndex(index);
  };

  const handleQuestionDrop = (event, targetIndex) => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isInteger(sourceIndex) && sourceIndex !== targetIndex) {
      moveQuestion(sourceIndex, targetIndex);
    }
    setDraggedQuestionIndex(null);
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              options: question.options.map((option, itemIndex) =>
                itemIndex === optionIndex ? value : option
              ),
            }
          : question
      ),
    }));
  };

  const addOption = (questionIndex) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? { ...question, options: [...question.options, ""] }
          : question
      ),
    }));
  };

  const removeOption = (questionIndex, optionIndex) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? { ...question, options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex) }
          : question
      ),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        formId ? `/api/admin/forms/${formId}` : "/api/admin/forms",
        {
          method: formId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save form.");
      setMessage("Form saved.");
      if (!formId) router.replace(`/admin/forms/${result.form.id}/edit`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="opacity-60">Loading form...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10 lg:px-24">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => router.push("/admin/forms")} className="text-sm opacity-60 hover:opacity-100">
          Back to Forms
        </button>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] opacity-50">Form builder</p>
            <h1 className="mt-2 text-4xl font-bold">{formId ? "Edit form" : "New form"}</h1>
          </div>
          {formId && <a href={`/forms/${form.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-dark/20 px-4 py-2 text-center text-sm font-medium">Preview form</a>}
        </div>

        <form onSubmit={save} className="mt-10 space-y-6">
          <section className="rounded-2xl border border-dark/15 p-6">
            <input value={form.title} onChange={(event) => update("title", event.target.value)} className="w-full border-0 border-b border-dark/20 bg-transparent px-4 text-3xl font-bold focus:border-dark focus:ring-0" placeholder="Form title" required />
            <textarea value={form.description} onChange={(event) => update("description", event.target.value)} className="mt-5 min-h-24 w-full resize-y border-0 bg-transparent px-4 focus:ring-0" placeholder="Form description (optional)" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Public URL<input value={form.slug} onChange={(event) => update("slug", slugify(event.target.value))} className="mt-2 block w-full rounded-lg border-dark/20 bg-transparent" placeholder="my-form" /></label>
              <label className="text-sm font-medium">Status<div className="mt-2"><CustomMenu value={form.status} options={statusOptions} placeholder="Choose status" onChange={(value) => update("status", value)} /></div></label>
            </div>
          </section>

          <section className="rounded-2xl border border-dark/15 p-6">
            <h2 className="text-xl font-semibold">Responses</h2>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3"><input type="checkbox" checked={form.settings.collectEmail} onChange={(event) => updateSetting("collectEmail", event.target.checked)} /> Collect email addresses</label>
              <label className="flex items-center gap-3"><input type="checkbox" checked={form.settings.limitOneResponse} onChange={(event) => updateSetting("limitOneResponse", event.target.checked)} /> Limit one response per email</label>
              <label className="flex items-center gap-3"><input type="checkbox" checked={form.settings.sendResponseReceipt} onChange={(event) => updateSetting("sendResponseReceipt", event.target.checked)} /> Email respondents a copy of their answers</label>
            </div>
            <label className="mt-5 block text-sm font-medium">Confirmation message<textarea value={form.confirmation_message} onChange={(event) => update("confirmation_message", event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border-dark/20 bg-transparent" /></label>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="cursor-pointer rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium">
                {uploadingConfirmationImage ? "Uploading..." : form.confirmation_image_url ? "Replace confirmation image" : "Add confirmation image"}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => uploadConfirmationImage(event.target.files?.[0])} disabled={uploadingConfirmationImage} />
              </label>
              {form.confirmation_image_url && <><img src={form.confirmation_image_url} alt="" className="h-16 w-24 rounded-lg object-cover" /><button type="button" onClick={() => update("confirmation_image_url", "")} className="text-sm text-red-600">Remove image</button></>}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Questions</h2><button type="button" onClick={addQuestion} className="rounded-lg bg-dark px-4 py-2 text-sm font-medium text-light dark:bg-light dark:text-dark">+ Add question</button></div>
            {form.questions.length === 0 && <div className="rounded-2xl border border-dashed border-dark/20 p-10 text-center opacity-60">Add your first question to begin.</div>}
            {form.questions.map((question, index) => (
              <article key={question.id || index} draggable onDragStart={(event) => handleQuestionDragStart(event, index)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handleQuestionDrop(event, index)} onDragEnd={() => setDraggedQuestionIndex(null)} className={`rounded-2xl border border-dark/15 p-5 transition-opacity ${draggedQuestionIndex === index ? "opacity-40" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <button type="button" className="cursor-grab text-sm font-medium opacity-50 active:cursor-grabbing" aria-label={`Drag question ${index + 1}`}>Question {index + 1} <span aria-hidden="true">⋮⋮</span></button>
                  <button type="button" onClick={() => removeQuestion(index)} className="text-sm text-red-600">Remove</button>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_220px]">
                  <input value={question.title || ""} onChange={(event) => updateQuestion(index, "title", event.target.value)} className="rounded-lg border-dark/20 bg-transparent" placeholder="Question" required />
                  <CustomMenu value={question.type} options={FORM_QUESTION_TYPES} placeholder="Choose question type" onChange={(value) => updateQuestion(index, "type", value)} />
                </div>
                <input value={question.description || ""} onChange={(event) => updateQuestion(index, "description", event.target.value)} className="mt-3 w-full rounded-lg border-dark/20 bg-transparent" placeholder="Help text (optional)" />
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <label className="cursor-pointer rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium">
                    {uploadingQuestionIndex === index ? "Uploading..." : question.image_url ? "Replace image" : "Add image"}
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => uploadQuestionImage(index, event.target.files?.[0])} disabled={uploadingQuestionIndex === index} />
                  </label>
                  {question.image_url && <><img src={question.image_url} alt="" className="h-16 w-24 rounded-lg object-cover" /><button type="button" onClick={() => updateQuestion(index, "image_url", "")} className="text-sm text-red-600">Remove image</button></>}
                </div>
                  {["multiple_choice", "checkboxes", "dropdown"].includes(question.type) && <div className="mt-4 space-y-2">{(question.options || []).map((option, optionIndex) => <div key={optionIndex} className="flex gap-2"><input value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} className="flex-1 rounded-lg border-dark/20 bg-transparent" placeholder={`Option ${optionIndex + 1}`} /><button type="button" onClick={() => removeOption(index, optionIndex)} className="px-2 text-red-600">Remove</button></div>)}<button type="button" onClick={() => addOption(index)} className="text-sm font-medium underline">Add option</button>{question.type === "multiple_choice" && <label className="mt-3 flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(question.validation?.allowOther)} onChange={(event) => updateQuestion(index, "validation", { ...question.validation, allowOther: event.target.checked })} /> Allow respondents to enter another answer</label>}</div>}
                <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, "required", event.target.checked)} /> Required</label>
              </article>
            ))}
          </section>

          {error && <p className="rounded-lg border border-red-500/30 p-4 text-red-600">{error}</p>}
          {message && <p className="rounded-lg border border-green-500/30 p-4 text-green-700">{message}</p>}
          <button type="submit" disabled={saving} className="rounded-lg bg-dark px-6 py-3 font-medium text-light dark:bg-light dark:text-dark disabled:opacity-50">{saving ? "Saving..." : "Save form"}</button>
        </form>
      </div>
    </main>
  );
}
