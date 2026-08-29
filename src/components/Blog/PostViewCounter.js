"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

export default function PostViewCounter({ slug }) {
  const [views, setViews] = useState(null);

  useEffect(() => {
    if (!slug) return;

    const storageKey = `ats-viewed-${slug}`;

    const getCurrentViews = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("post_views")
        .select("view_count")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        console.error("Could not fetch view count:", error);
        return;
      }

      setViews(Number(data?.view_count) || 0);
    };

    const recordView = async () => {
      const supabase = createClient();

      const { data, error } = await supabase.rpc(
        "increment_post_view",
        {
          post_slug: slug,
        }
      );

      if (error) {
        console.error("Could not increment view count:", error);
        return;
      }

      // Mark this post as viewed for this browser session.
      sessionStorage.setItem(storageKey, "true");

      setViews(Number(data) || 0);
    };

    // --------------------------------------------------
    // HAS THIS BROWSER SESSION ALREADY VIEWED THIS POST?
    // --------------------------------------------------

    const alreadyViewed = sessionStorage.getItem(storageKey);

    if (alreadyViewed === "true") {
      // DO NOT increment.
      // Just retrieve the existing number.
      getCurrentViews();
    } else {
      // First visit in this browser session.
      // Increment exactly once.
      recordView();
    }
  }, [slug]);

  if (views === null) {
    return (
      <span className="whitespace-nowrap text-base sm:text-lg font-medium">
        …
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap text-base sm:text-lg font-medium">
      {views} {views === 1 ? "view" : "views"}
    </span>
  );
}