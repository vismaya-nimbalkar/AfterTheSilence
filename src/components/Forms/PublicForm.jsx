"use client";

import { useState } from "react";

export default function PublicForm({ form }) {
  const [answers, setAnswers] = useState({});
  const [otherAnswers, setOtherAnswers] = useState({});
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ loading: false, error: "", confirmation: "", confirmationImage: "" });
  const questions = [...(form.form_questions || [])].sort((a, b) => a.position - b.position);

  const setAnswer = (id, value) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  const clearAnswer = (id) => {
    setAnswers((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setOtherAnswers((current) => ({ ...current, [id]: "" }));
  };

  const toggleCheckbox = (id, option) => {
    const current = answers[id] || [];
    setAnswer(id, current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  };

  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: "", confirmation: "" });
    const submittedAnswers = { ...answers };

    questions.forEach((question) => {
      if (question.type === "multiple_choice" && answers[question.id] === "__other__") {
        submittedAnswers[question.id] = `Other: ${(otherAnswers[question.id] || "").trim()}`;
      }
    });

    try {
      const response = await fetch(`/api/forms/${form.slug}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: submittedAnswers, respondentEmail: email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your response.");
      setState({ loading: false, error: "", confirmation: result.confirmationMessage, confirmationImage: result.confirmationImageUrl || "" });
    } catch (error) {
      setState({ loading: false, error: error.message, confirmation: "", confirmationImage: "" });
    }
  };

  if (state.confirmation) {
    return <main className="min-h-screen px-6 py-20"><div className="mx-auto max-w-2xl rounded-2xl border border-dark/15 p-8 sm:p-12"><p className="text-sm uppercase tracking-[0.18em] opacity-50">Response received</p><h1 className="mt-4 text-3xl font-bold">Thank you</h1><p className="mt-4 leading-7 opacity-70">{state.confirmation}</p>{state.confirmationImage && <img src={state.confirmationImage} alt="" className="mt-8 max-h-96 w-full rounded-xl object-contain" />}</div></main>;
  }

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <header className="rounded-2xl border-x border-b border-t-8 border-dark border-dark/15 p-7 sm:p-10">
          <h1 className="text-4xl font-bold">{form.title}</h1>
          {form.description && <p className="mt-4 whitespace-pre-wrap leading-7 opacity-70">{form.description}</p>}
          {(form.settings?.collectEmail || form.settings?.sendResponseReceipt) && <label className="mt-8 block font-medium">Email address{form.settings?.sendResponseReceipt && <span className="ml-2 text-sm font-normal opacity-60">A copy of your answers will be sent here.</span>}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-lg border-dark/20 bg-transparent" required /></label>}
        </header>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {questions.map((question) => {
            const allowOther = question.type === "multiple_choice" && question.validation?.allowOther;
            const selectedOther = answers[question.id] === "__other__";

            return <fieldset key={question.id} className="rounded-2xl border border-dark/15 p-6">
              <legend className="max-w-full px-1 text-lg font-semibold">{question.title}{question.required && <span className="ml-1 text-red-600">*</span>}</legend>
              {question.description && <p className="mt-1 text-sm opacity-60">{question.description}</p>}
              {question.image_url && <img src={question.image_url} alt={question.title || "Question image"} className="mt-5 max-h-80 w-full rounded-xl object-contain" />}
              {question.type === "short_text" && <input required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-5 block w-full rounded-lg border-dark/20 bg-transparent" />}
              {question.type === "long_text" && <textarea required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-5 min-h-32 block w-full rounded-lg border-dark/20 bg-transparent" />}
              {question.type === "date" && <input type="date" required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-5 rounded-lg border-dark/20 bg-transparent" />}
              {question.type === "time" && <input type="time" required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-5 rounded-lg border-dark/20 bg-transparent" />}
              {question.type === "dropdown" && <select required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-5 block w-full rounded-lg border-dark/20 bg-transparent"><option value="">Choose an option</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
              {question.type === "multiple_choice" && <div className="mt-5 space-y-3">{question.options.map((option) => <label key={option} className="flex items-center gap-3"><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswer(question.id, option)} />{option}</label>)}{allowOther && <><label className="flex items-center gap-3"><input type="radio" name={question.id} value="__other__" checked={selectedOther} onChange={() => setAnswer(question.id, "__other__")} />Other</label>{selectedOther && <input value={otherAnswers[question.id] || ""} onChange={(event) => setOtherAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="ml-7 block w-[calc(100%-1.75rem)] rounded-lg border-dark/20 bg-transparent" placeholder="Please specify" required={question.required} />}</>}<button type="button" onClick={() => clearAnswer(question.id)} className="text-sm font-medium underline">Clear selection</button></div>}
              {question.type === "checkboxes" && <div className="mt-5 space-y-3">{question.options.map((option) => <label key={option} className="flex items-center gap-3"><input type="checkbox" value={option} checked={(answers[question.id] || []).includes(option)} onChange={() => toggleCheckbox(question.id, option)} />{option}</label>)}<button type="button" onClick={() => clearAnswer(question.id)} className="text-sm font-medium underline">Clear selections</button></div>}
            </fieldset>;
          })}
          {state.error && <p className="rounded-lg border border-red-500/30 p-4 text-red-600">{state.error}</p>}
          <button type="submit" disabled={state.loading} className="rounded-lg bg-dark px-6 py-3 font-medium text-light dark:bg-light dark:text-dark disabled:opacity-50">{state.loading ? "Submitting..." : "Submit"}</button>
        </form>
      </div>
    </main>
  );
}
