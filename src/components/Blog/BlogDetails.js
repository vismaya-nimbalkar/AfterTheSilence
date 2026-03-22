import { format, parseISO } from "date-fns";
import Link from "next/link";
import React from "react";

const generateSlug = (tag) =>
  tag.toLowerCase().trim().replace(/\s+/g, "-");

const BlogDetails = ({ blog }) => {
  return (
    <div className="px-6 md:px-10 py-4 md:py-5 bg-accent dark:bg-accentDark text-light dark:text-dark grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 items-center text-lg sm:text-xl font-medium mx-5 md:mx-10 rounded-lg">
      
      <time className="whitespace-nowrap text-left">
        {format(parseISO(blog.publishedAt), "LLLL d, yyyy")}
      </time>

      {blog.author && (
        <span className="whitespace-nowrap text-center md:text-left">
          {blog.author}
        </span>
      )}

      <span className="whitespace-nowrap text-center">
        {blog.readingTime.text}
      </span>

      <Link
        href={`/categories/${generateSlug(blog.tags[0])}`}
        className="hover:underline whitespace-nowrap text-right"
      >
        #{blog.tags[0]}
      </Link>

    </div>
  );
};

export default BlogDetails;