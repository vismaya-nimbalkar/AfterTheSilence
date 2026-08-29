import { format, parseISO } from "date-fns";
import Link from "next/link";
import React from "react";
import PostViewCounter from "./PostViewCounter";

const generateSlug = (tag) =>
  tag.toLowerCase().trim().replace(/\s+/g, "-");

const BlogDetails = ({ blog }) => {
  // Safety check
  if (!blog) {
    return null;
  }

  const firstTag =
    Array.isArray(blog.tags) && blog.tags.length > 0
      ? blog.tags[0]
      : null;

  // Extract slug string safety handling (Contentlayer vs direct object)
  const postSlug = typeof blog.slug === "string" ? blog.slug : blog._raw?.flattenedPath;

  return (
    <div
      className="
        px-6
        md:px-10
        py-4
        md:py-5
        bg-accent
        dark:bg-accentDark
        text-light
        dark:text-dark
        grid
        grid-cols-1
        sm:grid-cols-2
        md:grid-cols-5
        items-center
        text-lg
        sm:text-xl
        font-medium
        mx-5
        md:mx-10
        rounded-lg
        gap-y-3
      "
    >
      {/* Date */}
      <time className="whitespace-nowrap text-left">
        {blog.publishedAt
          ? format(
              parseISO(blog.publishedAt),
              "LLLL d, yyyy"
            )
          : "Date not available"}
      </time>

      {/* Author */}
      {blog.author && (
        <span className="whitespace-nowrap text-center md:text-left">
          {blog.author}
        </span>
      )}

      {/* Reading Time */}
      <span className="whitespace-nowrap text-center">
        {blog.readingTime?.text || "1 min read"}
      </span>

      {/* Views */}
      <div className="flex justify-center whitespace-nowrap">
        {postSlug ? (
          <PostViewCounter slug={postSlug} />
        ) : (
          <span className="text-sm opacity-70">👁 0 views</span>
        )}
      </div>

      {/* Category */}
      {firstTag ? (
        <Link
          href={`/categories/${generateSlug(firstTag)}`}
          className="
            hover:underline
            whitespace-nowrap
            text-right
          "
        >
          #{firstTag}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
};

export default BlogDetails;