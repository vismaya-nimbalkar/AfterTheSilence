"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function NewsletterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const [subscriberCount, setSubscriberCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /*
   * Make sure the user is logged in and
   * get the number of subscribers.
   */
  useEffect(() => {
    async function loadNewsletterData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/admin/login");
        return;
      }

      const { count, error } = await supabase
        .from("newsletter_subscribers")
        .select("*", {
          count: "exact",
          head: true,
        });

      if (error) {
        console.error(error);
        setError("Could not load subscribers.");
      } else {
        setSubscriberCount(count || 0);
      }

      setLoading(false);
    }

    loadNewsletterData();
  }, []);

  /*
   * Turn the newsletter text into simple HTML.
   */
  const generateHtml = () => {
    return content
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return "<br />";
        }

        if (trimmed.startsWith("# ")) {
          return `<h1 style="font-size:28px;line-height:1.3;margin:24px 0 12px;font-weight:700;">${trimmed.slice(
            2
          )}</h1>`;
        }

        if (trimmed.startsWith("## ")) {
          return `<h2 style="font-size:22px;line-height:1.4;margin:20px 0 10px;font-weight:700;">${trimmed.slice(
            3
          )}</h2>`;
        }

        return `<p style="font-size:16px;line-height:1.7;margin:0 0 16px;">${trimmed}</p>`;
      })
      .join("");
  };

  /*
   * Open the send confirmation.
   */
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

    if (subscriberCount === 0) {
      setError("There are no subscribers yet.");
      return;
    }

    setShowConfirm(true);
  };

  /*
   * Actually send the newsletter.
   */
  const sendNewsletter = async () => {
    setShowConfirm(false);
    setSending(true);
    setError("");
    setMessage("");

    try {
      /*
       * Get all subscribers.
       *
       * This request is only made after the user
       * has already authenticated through Supabase.
       */
      const {
        data: subscribers,
        error: subscriberError,
      } = await supabase
        .from("newsletter_subscribers")
        .select("email");

      if (subscriberError) {
        throw new Error(
          "Could not load newsletter subscribers."
        );
      }

      if (!subscribers || subscribers.length === 0) {
        throw new Error(
          "There are no newsletter subscribers."
        );
      }

      const emails = subscribers
        .map((subscriber) => subscriber.email)
        .filter(Boolean);

      /*
       * Resend allows a limited number of recipients
       * per request, so split the subscribers into
       * groups of 50.
       */
      const batches = [];

      for (let i = 0; i < emails.length; i += 50) {
        batches.push(emails.slice(i, i + 50));
      }

      /*
       * Send each batch.
       */
      for (const batch of batches) {
        const response = await fetch(
          "/api/send-newsletter",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: batch,
              subject: subject.trim(),
              html: generateHtml(),
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Could not send newsletter."
          );
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
        error.message ||
          "Something went wrong while sending the newsletter."
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="opacity-60">
          Loading newsletter...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">

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

            <p className="mt-8 text-sm opacity-60">
              After The Silence
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Newsletter
            </h1>

            <p className="mt-2 text-sm opacity-60">
              Write and send an update to your subscribers.
            </p>

          </div>

          {/* Subscriber count */}
          <div className="rounded-2xl border border-dark/20 px-6 py-4">

            <p className="text-sm opacity-60">
              Subscribers
            </p>

            <p className="mt-1 text-3xl font-bold">
              {subscriberCount}
            </p>

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

            <label
              htmlFor="subject"
              className="mb-2 block text-sm font-medium"
            >
              Subject
            </label>

            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              placeholder="What's new at After The Silence?"
              className="
                w-full
                rounded-xl
                border
                border-dark/20
                bg-transparent
                px-4
                py-3
                outline-none
                focus:border-dark
              "
            />

          </div>

          {/* Content */}
          <div className="mt-8">

            <label
              htmlFor="content"
              className="mb-2 block text-sm font-medium"
            >
              Newsletter
            </label>

            <textarea
              id="content"
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              placeholder={`# Hello everyone!

I've got something new to share with you.

I just published a new post on After The Silence...

Thank you for being here. 💜`}
              rows={20}
              className="
                w-full
                rounded-xl
                border
                border-dark/20
                bg-transparent
                px-4
                py-4
                font-mono
                text-sm
                leading-7
                outline-none
                focus:border-dark
                resize-y
              "
            />

            <p className="mt-2 text-sm opacity-50">
              Markdown-style headings are supported using # and ##.
            </p>

          </div>

          {/* Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">

            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={
                !subject.trim() ||
                !content.trim()
              }
              className="
                rounded-xl
                border
                border-dark
                px-6
                py-3
                font-medium
                transition-opacity
                hover:opacity-70
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
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
                subscriberCount === 0
              }
              className="
                rounded-xl
                bg-dark
                px-6
                py-3
                font-medium
                text-light
                transition-opacity
                hover:opacity-80
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              {sending
                ? "Sending..."
                : "Send Newsletter"}
            </button>

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

                <h2 className="mt-1 text-xl font-bold text-black">
                  {subject}
                </h2>
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
                You are receiving this email because you subscribed to
                After The Silence.
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Send Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

            <h2 className="text-2xl font-bold text-black">
              Send Newsletter?
            </h2>

            <p className="mt-4 leading-7 text-gray-600">
              You're about to send this newsletter to{" "}
              <strong>
                {subscriberCount}
              </strong>{" "}
              subscriber
              {subscriberCount === 1 ? "" : "s"}.
            </p>

            <div className="mt-5 rounded-xl bg-gray-50 p-4">

              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Subject
              </p>

              <p className="mt-1 font-semibold text-black">
                {subject}
              </p>

            </div>

            <p className="mt-4 text-sm text-gray-500">
              This will send the newsletter immediately.
            </p>

            <div className="mt-7 flex gap-3">

              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                className="
                  flex-1
                  rounded-xl
                  border
                  border-black/20
                  px-4
                  py-3
                  font-medium
                  text-black
                  hover:bg-black/5
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={sendNewsletter}
                disabled={sending}
                className="
                  flex-1
                  rounded-xl
                  bg-black
                  px-4
                  py-3
                  font-medium
                  text-white
                  hover:opacity-80
                  disabled:opacity-50
                "
              >
                {sending
                  ? "Sending..."
                  : "Yes, Send It"}
              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}