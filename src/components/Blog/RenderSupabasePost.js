"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const RenderSupabasePost = ({ content }) => {
  return (
    <div
      className="
        col-span-12
        lg:col-span-8
        font-in
        prose
        sm:prose-base
        md:prose-lg
        max-w-max

        prose-blockquote:bg-accent/20
        prose-blockquote:p-2
        prose-blockquote:px-6
        prose-blockquote:border-accent
        prose-blockquote:not-italic
        prose-blockquote:rounded-r-lg

        prose-li:marker:text-accent

        dark:prose-invert
        dark:prose-blockquote:border-accentDark
        dark:prose-blockquote:bg-accentDark/20
        dark:prose-li:marker:text-accentDark

        first-letter:text-3xl
        sm:first-letter:text-5xl
      "
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          img: ({ node, src, alt, ...props }) => {
            if (!src) return null;

            return (
              <span className="block my-6">
                <img
                  {...props}
                  src={src}
                  alt={alt || "Blog content image"}
                  className="w-full h-auto rounded-xl object-cover block min-h-[200px] bg-neutral-800"
                  onError={(e) => {
                    console.error("Failed to load image from URL:", src);
                  }}
                />
              </span>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default RenderSupabasePost;