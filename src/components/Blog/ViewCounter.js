"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only create Supabase client if env vars exist
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const ViewCounter = ({ slug, noCount = false, showCount = true }) => {
  const [views, setViews] = useState(0);

  // Increment view count
  useEffect(() => {
    if (!supabase || noCount || !slug) return;

    const incrementView = async () => {
      try {
        await supabase.rpc("increment", {
          slug_text: slug,
        });
      } catch (error) {
        console.error("ViewCounter increment error:", error);
      }
    };

    incrementView();
  }, [slug, noCount]);

  // Fetch view count
  useEffect(() => {
    if (!supabase || !slug) return;

    const getViews = async () => {
      try {
        const { data } = await supabase
          .from("views")
          .select("count")
          .match({ slug })
          .single();

        setViews(data?.count ?? 0);
      } catch (error) {
        console.error("ViewCounter fetch error:", error);
      }
    };

    getViews();
  }, [slug]);

  if (!showCount || !supabase) return null;

  return <div>{views} views</div>;
};

export default ViewCounter;