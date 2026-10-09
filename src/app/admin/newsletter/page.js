"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import RichTextEditor from "@/src/components/Admin/RichTextEditor";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineToHtml(nodes = []) {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br>";
      if (node.type !== "text") return "";

      let value = escapeHtml(node.text);
      for (const mark of node.marks || []) {
        if (mark.type === "bold") value = `<strong>${value}</strong>`;
        if (mark.type === "italic") value = `<em>${value}</em>`;
        if (mark.type === "underline") value = `<u>${value}</u>`;
        if (mark.type === "strike") value = `<s>${value}</s>`;
        if (mark.type === "code") value = `<code>${value}</code>`;
        if (mark.type === "highlight") value = `<mark>${value}</mark>`;
        if (mark.type === "link")
          value = `<a href="${escapeHtml(mark.attrs?.href || "#")}">${value}</a>`;
      }
      return value;
    })
    .join("");
}

function newsletterContentToHtml(value) {
  try {
    const parsed = JSON.parse(value);
    const document = parsed?.document || parsed;
    const renderNodes = (nodes = []) =>
      nodes
        .map((node) => {
          const content = inlineToHtml(node.content);
          if (node.type === "paragraph")
            return `<p style="font-size:16px;line-height:1.7;margin:0 0 16px">${content}</p>`;
          if (node.type === "heading")
            return `<h${node.attrs?.level || 2} style="line-height:1.3;margin:24px 0 12px">${content}</h${node.attrs?.level || 2}>`;
          if (node.type === "blockquote")
            return `<blockquote style="border-left:4px solid #9490d4;padding-left:16px;margin:20px 0">${renderNodes(node.content)}</blockquote>`;
          if (node.type === "bulletList")
            return `<ul>${renderNodes(node.content)}</ul>`;
          if (node.type === "orderedList")
            return `<ol>${renderNodes(node.content)}</ol>`;
          if (node.type === "listItem")
            return `<li style="margin:6px 0">${renderNodes(node.content)}</li>`;
          if (node.type === "image" && node.attrs?.src)
            return `<img src="${escapeHtml(node.attrs.src)}" alt="${escapeHtml(node.attrs.alt || "")}" style="display:block;max-width:100%;height:auto;margin:24px 0;border-radius:8px">`;
          return content;
        })
        .join("");
    return renderNodes(document?.content || []);
  } catch {
    return `<p style="font-size:16px;line-height:1.7">${escapeHtml(value).replaceAll("\n", "<br>")}</p>`;
  }
}

export default function NewsletterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const [subscribers, setSubscribers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    async function loadNewsletterData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/admin/login");
        return;
      }

      const response = await fetch("/api/admin/newsletter/subscribers", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not load subscribers.");
      setSubscribers(result.subscribers || []);

      setLoading(false);
    }

    loadNewsletterData();
  }, []);

  const generateHtml = () => {
    return newsletterContentToHtml(content);
  };

  const handlePrepareSend = () => {
    setError("");
    setMessage("");

    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!content.trim()) {
      setError("Please write your newsletter.");
      return;
    }

    if (subscribers.length === 0) {
      setError("There are no subscribers yet.");
      return;
    }

    setShowConfirm(true);
  };

  const sendNewsletter = async () => {
    setShowConfirm(false);
    setSending(true);
    setError("");
    setMessage("");

    try {
      if (subscribers.length === 0) {
        throw new Error("There are no newsletter subscribers.");
      }

      const emails = subscribers
        .map((subscriber) => subscriber.email)
        .filter(Boolean);

      // Resend batch sending allows up to 100 per API request
      const batches = [];
      for (let i = 0; i < emails.length; i += 100) {
        batches.push(emails.slice(i, i + 100));
      }

      for (const batch of batches) {
        const response = await fetch("/api/send-newsletter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: batch,
            subject: subject.trim(),
            html: generateHtml(),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not send newsletter.");
        }
      }

      setMessage(
        `Newsletter sent successfully to ${emails.length} subscriber${
          emails.length === 1 ? "" : "s"
        }. 🎉`
      );

      setSubject("");
      setContent("");
    } catch (error) {
      console.error(error);
      setError(
        error.message || "Something went wrong while sending the newsletter."
      );
    } finally {
      setSending(false);
    }
  };

  const removeSubscriber = async (subscriber) => {
    if (
      !(await confirm({
        title: "Unsubscribe this person?",
        message: `${subscriber.email} will stop receiving the newsletter.`,
        confirmLabel: "Unsubscribe",
        danger: false,
      }))
    )
      return;

    const response = await fetch("/api/admin/newsletter/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subscriber.id }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not unsubscribe this person.");
      return;
    }
    setSubscribers((current) =>
      current.filter((item) => item.id !== subscriber.id)
    );
    setMessage(`${subscriber.email} has been unsubscribed.`);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="opacity-60">Loading newsletter...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      {dialog}

      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            >
              ← Back to Dashboard
            </button>

            <p className="mt-8 text-sm opacity-60">After The Silence</p>

            <h1 className="mt-2 text-4xl font-bold">Newsletter</h1>

            <p className="mt-2 text-sm opacity-60">
              Write and send an update to your subscribers.
            </p>
          </div>

          {/* Subscriber count */}
          <div className="rounded-2xl border border-dark/20 px-6 py-4">
            <p className="text-sm opacity-60">Subscribers</p>
            <p className="mt-1 text-3xl font-bold">{subscribers.length}</p>
          </div>

        </div>

        {/* Error */}
        {error && (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Success */}
        {message && (
          <div className="mt-8 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Newsletter editor */}
        <section className="mt-10 rounded-2xl border border-dark/20 p-6 sm:p-8">

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="mb-2 block text-sm font-medium">
              Subject
            </label>

            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What's new at After The Silence?"
              className="w-full rounded-xl border border-dark/20 bg-transparent px-4 py-3 outline-none focus:border-dark"
            />
          </div>

          {/* Content */}
          <div className="mt-8">
            <label htmlFor="content" className="mb-2 block text-sm font-medium">
              Newsletter
            </label>

            <RichTextEditor value={content} onChange={setContent} />
          </div>

          {/* Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={!subject.trim() || !content.trim()}
              className="rounded-xl border border-dark px-6 py-3 font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Preview
            </button>

            <button
              type="button"
              onClick={handlePrepareSend}
              disabled={
                sending ||
                !subject.trim() ||
                !content.trim() ||
                subscribers.length === 0
              }
              className="rounded-xl bg-dark px-6 py-3 font-medium text-light transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending..." : "Send Newsletter"}
            </button>
          </div>

        </section>

        <section className="mt-10 rounded-2xl border border-dark/20 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Subscribers</h2>
              <p className="mt-1 text-sm opacity-60">
                Remove anyone who asks to stop receiving updates.
              </p>
            </div>
            <span className="text-sm opacity-60">{subscribers.length} total</span>
          </div>

          <div className="mt-6 divide-y divide-dark/10 rounded-xl border border-dark/10">
            {subscribers.length === 0 ? (
              <p className="p-6 text-sm opacity-60">No subscribers yet.</p>
            ) : (
              subscribers.map((subscriber) => (
                <div
                  key={subscriber.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
                >
                  <div>
                    <p className="font-medium">{subscriber.email}</p>
                    {subscriber.created_at && (
                      <p className="mt-1 text-xs opacity-50">
                        Subscribed{" "}
                        {new Date(subscriber.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSubscriber(subscriber)}
                    className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10"
                  >
                    Unsubscribe
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Newsletter Preview
                </p>
                <h2 className="mt-1 text-xl font-bold text-black">{subject}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-full px-3 py-2 text-sm hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-8 sm:px-10">
              <div
                className="text-black"
                dangerouslySetInnerHTML={{
                  __html: generateHtml(),
                }}
              />
              <div className="mt-10 border-t border-black/10 pt-6 text-xs text-gray-500">
                You are receiving this email because you subscribed to After The Silence.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-black">Send Newsletter?</h2>

            <p className="mt-4 leading-7 text-gray-600">
              You're about to send this newsletter to{" "}
              <strong>{subscribers.length}</strong> subscriber
              {subscribers.length === 1 ? "" : "s"}.
            </p>

            <div className="mt-5 rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Subject
              </p>
              <p className="mt-1 font-semibold text-black">{subject}</p>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              This will send the newsletter immediately.
            </p>

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                className="flex-1 rounded-xl border border-black/20 px-4 py-3 font-medium text-black hover:bg-black/5"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={sendNewsletter}
                disabled={sending}
                className="flex-1 rounded-xl bg-black px-4 py-3 font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Yes, Send It"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}