"use client";

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

export default function NewsletterForm() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setStatus("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setStatus("Please enter your email address.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({
        email: cleanEmail,
      });

    if (error) {
      if (error.code === "23505") {
        setStatus("You're already subscribed!");
      } else {
        console.error(error);
        setStatus("Something went wrong. Please try again.");
      }

      setLoading(false);
      return;
    }

    setEmail("");

    setStatus("You're subscribed! Thanks for joining");

    setLoading(false);
  };

  return (
    <div className="mt-8 w-full max-w-xl px-6">

      {/* Newsletter form */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email address"
          aria-label="Email address"
          autoComplete="email"
          required
          className="
            min-w-0
            flex-1
            rounded-xl
            border
            border-light/30
            dark:border-dark/30
            bg-transparent
            px-5
            py-3
            text-light
            dark:text-dark
            placeholder:text-light/50
            dark:placeholder:text-dark/50
            outline-none
            focus:border-light
            dark:focus:border-dark
          "
        />

        <button
          type="submit"
          disabled={loading}
          className="
            shrink-0
            rounded-xl
            bg-light
            dark:bg-dark
            px-6
            py-3
            font-semibold
            text-dark
            dark:text-light
            transition-opacity
            hover:opacity-80
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {loading ? "Subscribing..." : "Subscribe"}
        </button>
      </form>

      {/* Status message */}
      {status && (
        <p className="mt-3 text-center text-sm opacity-80">
          {status}
        </p>
      )}

      {/* Privacy / spam note */}
      <p className="mt-3 text-center text-xs opacity-50">
        Occasional updates. No spam.
      </p>

    </div>
  );
}