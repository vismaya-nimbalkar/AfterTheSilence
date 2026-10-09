"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";

function downloadCsv(rows, questions) {
  const headers = [
    "Submitted",
    "Email",
    ...questions.map((question) => question.title),
  ];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers,
    ...rows.map((row) => [
      row.created_at,
      row.respondent_email,
      ...questions.map((question) =>
        Array.isArray(row.answers?.[question.id])
          ? row.answers[question.id].join(", ")
          : row.answers?.[question.id] || "",
      ),
    ]),
  ].map((line) => line.map(escape).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "form-responses.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function FormResponsesPage({ params }) {
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    Promise.resolve(params)
      .then(({ id: formId }) =>
        Promise.all([
          fetch(`/api/admin/forms/${formId}`).then((response) =>
            response.json(),
          ),
          fetch(`/api/admin/forms/${formId}/responses`).then((response) =>
            response.json(),
          ),
        ]),
      )
      .then(([formResult, responseResult]) => {
        if (formResult.error || responseResult.error)
          throw new Error(formResult.error || responseResult.error);
        setForm(formResult.form);
        setResponses(responseResult.responses || []);
      })
      .catch((err) => setError(err.message));
  }, [params]);

  const deleteResponse = async (responseId) => {
    if (
      !(await confirm({
        title: "Delete response?",
        message: "This response will be permanently deleted.",
        confirmLabel: "Delete response",
      }))
    )
      return;
    setDeletingId(responseId);
    setError("");
    try {
      const { id: formId } = await params;
      const response = await fetch(`/api/admin/forms/${formId}/responses`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not delete response.");
      setResponses((current) =>
        current.filter((item) => item.id !== responseId),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (error && !form) return <main className="p-10 text-red-600">{error}</main>;
  if (!form)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="opacity-60">Loading responses...</p>
      </main>
    );

  const questions = [...(form.form_questions || [])].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      {dialog}
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => router.push("/admin/forms")}
          className="text-sm opacity-60 hover:opacity-100"
        >
          Back to Forms
        </button>
        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] opacity-50">
              Responses
            </p>
            <h1 className="mt-2 text-4xl font-bold">{form.title}</h1>
            <p className="mt-2 opacity-60">
              {responses.length} response{responses.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(responses, questions)}
            disabled={!responses.length}
            className="rounded-lg bg-dark px-5 py-3 font-medium text-light dark:bg-light dark:text-dark disabled:opacity-40"
          >
            Download CSV
          </button>
        </div>
        {error && (
          <p className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">
            {error}
          </p>
        )}
        <div className="mt-10 overflow-x-auto rounded-2xl border border-dark/15">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-dark/15">
                <th className="whitespace-nowrap px-4 py-4 font-semibold">
                  Submitted
                </th>
                <th className="whitespace-nowrap px-4 py-4 font-semibold">
                  Email
                </th>
                {questions.map((question) => (
                  <th
                    key={question.id}
                    className="min-w-48 px-4 py-4 font-semibold"
                  >
                    {question.title}
                  </th>
                ))}
                <th className="px-4 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response) => (
                <tr
                  key={response.id}
                  className="border-b border-dark/10 last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-4 opacity-70">
                    {new Date(response.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    {response.respondent_email || "-"}
                  </td>
                  {questions.map((question) => (
                    <td key={question.id} className="px-4 py-4">
                      {Array.isArray(response.answers?.[question.id])
                        ? response.answers[question.id].join(", ")
                        : response.answers?.[question.id] || "-"}
                    </td>
                  ))}
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => deleteResponse(response.id)}
                      disabled={deletingId === response.id}
                      className="whitespace-nowrap text-red-600 hover:underline disabled:opacity-50"
                    >
                      {deletingId === response.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {responses.length === 0 && (
            <p className="p-12 text-center opacity-60">No responses yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
