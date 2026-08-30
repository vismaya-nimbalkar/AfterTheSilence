"use client";

import React from "react";

/* ============================================================
   MARKS
============================================================ */

function renderMarks(text, marks = []) {
  let result = text;

  marks.forEach((mark) => {
    if (mark.type === "bold") {
      result = (
        <strong className="font-bold">
          {result}
        </strong>
      );
    }

    if (mark.type === "italic") {
      result = (
        <em className="italic">
          {result}
        </em>
      );
    }

    if (mark.type === "underline") {
      result = (
        <u className="underline underline-offset-2">
          {result}
        </u>
      );
    }

    if (mark.type === "strike") {
      result = (
        <s>{result}</s>
      );
    }

    if (mark.type === "code") {
      result = (
        <code
          className="
            rounded
            bg-dark/10
            px-1.5
            py-0.5
            font-mono
            text-[0.9em]
          "
        >
          {result}
        </code>
      );
    }

    if (mark.type === "highlight") {
      result = (
        <mark className="rounded px-1">
          {result}
        </mark>
      );
    }

    if (mark.type === "link") {
      result = (
        <a
          href={
            mark.attrs?.href ||
            "#"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="
            underline
            underline-offset-2
            transition-opacity
            hover:opacity-60
          "
        >
          {result}
        </a>
      );
    }
  });

  return result;
}

/* ============================================================
   INLINE CONTENT
============================================================ */

function InlineContent({
  content = [],
}) {
  return (
    <>
      {content.map(
        (node, index) => {
          const key =
            `${node.type}-${node.attrs?.id || ""}-${index}`;

          if (
            node.type === "text"
          ) {
            return (
              <React.Fragment
                key={key}
              >
                {renderMarks(
                  node.text,
                  node.marks
                )}
              </React.Fragment>
            );
          }

          if (
            node.type ===
            "hardBreak"
          ) {
            return (
              <br
                key={key}
              />
            );
          }

          if (
            node.type ===
            "footnoteReference"
          ) {
            return (
              <sup
                key={key}
                className="
                  ml-0.5
                  align-super
                  text-[0.65em]
                  font-semibold
                  leading-none
                "
              >
                {node.attrs?.number ||
                  1}
              </sup>
            );
          }

          if (
            node.type === "image"
          ) {
            return (
              <img
                key={key}
                src={
                  node.attrs?.src
                }
                alt={
                  node.attrs?.alt ||
                  "Blog image"
                }
                title={
                  node.attrs?.title ||
                  undefined
                }
                className="
                  my-8
                  block
                  h-auto
                  w-full
                  rounded-xl
                  object-cover
                "
              />
            );
          }

          return null;
        }
      )}
    </>
  );
}

/* ============================================================
   NODE RENDERER
============================================================ */

function RenderNode({
  node,
  index,
}) {
  if (!node) {
    return null;
  }

  const key =
    `${node.type}-${node.attrs?.id || ""}-${index}`;

  /* ----------------------------------------------------------
     PARAGRAPH
  ---------------------------------------------------------- */

  if (
    node.type === "paragraph"
  ) {
    return (
      <p
        key={key}
        className="mb-6 leading-8"
      >
        <InlineContent
          content={
            node.content
          }
        />
      </p>
    );
  }

  /* ----------------------------------------------------------
     HEADING
  ---------------------------------------------------------- */

  if (
    node.type === "heading"
  ) {
    const level =
      node.attrs?.level || 2;

    if (level === 1) {
      return (
        <h1
          key={key}
          className="
            mb-6
            mt-10
            text-4xl
            font-bold
            leading-tight
            sm:text-5xl
          "
        >
          <InlineContent
            content={
              node.content
            }
          />
        </h1>
      );
    }

    if (level === 2) {
      return (
        <h2
          key={key}
          className="
            mb-5
            mt-10
            text-3xl
            font-bold
            leading-tight
          "
        >
          <InlineContent
            content={
              node.content
            }
          />
        </h2>
      );
    }

    return (
      <h3
        key={key}
        className="
          mb-4
          mt-8
          text-2xl
          font-semibold
          leading-tight
        "
      >
        <InlineContent
          content={
            node.content
          }
        />
      </h3>
    );
  }

  /* ----------------------------------------------------------
     BLOCKQUOTE
  ---------------------------------------------------------- */

  if (
    node.type ===
    "blockquote"
  ) {
    return (
      <blockquote
        key={key}
        className="
          my-8
          rounded-r-lg
          border-l-4
          border-accent
          bg-accent/20
          px-6
          py-4
          italic
        "
      >
        {node.content?.map(
          (
            child,
            childIndex
          ) => (
            <RenderNode
              key={`${key}-${childIndex}`}
              node={child}
              index={
                childIndex
              }
            />
          )
        )}
      </blockquote>
    );
  }

  /* ----------------------------------------------------------
     BULLET LIST
  ---------------------------------------------------------- */

  if (
    node.type ===
    "bulletList"
  ) {
    return (
      <ul
        key={key}
        className="
          mb-6
          ml-6
          list-disc
          space-y-2
        "
      >
        {node.content?.map(
          (
            child,
            childIndex
          ) => (
            <RenderNode
              key={`${key}-${childIndex}`}
              node={child}
              index={
                childIndex
              }
            />
          )
        )}
      </ul>
    );
  }

  /* ----------------------------------------------------------
     ORDERED LIST
  ---------------------------------------------------------- */

  if (
    node.type ===
    "orderedList"
  ) {
    return (
      <ol
        key={key}
        className="
          mb-6
          ml-6
          list-decimal
          space-y-2
        "
      >
        {node.content?.map(
          (
            child,
            childIndex
          ) => (
            <RenderNode
              key={`${key}-${childIndex}`}
              node={child}
              index={
                childIndex
              }
            />
          )
        )}
      </ol>
    );
  }

  /* ----------------------------------------------------------
     LIST ITEM
  ---------------------------------------------------------- */

  if (
    node.type ===
    "listItem"
  ) {
    return (
      <li
        key={key}
        className="leading-7"
      >
        {node.content?.map(
          (
            child,
            childIndex
          ) => (
            <RenderNode
              key={`${key}-${childIndex}`}
              node={child}
              index={
                childIndex
              }
            />
          )
        )}
      </li>
    );
  }

  /* ----------------------------------------------------------
     CODE BLOCK
  ---------------------------------------------------------- */

  if (
    node.type ===
    "codeBlock"
  ) {
    const code =
      node.content
        ?.map(
          (child) =>
            child.text || ""
        )
        .join("") || "";

    return (
      <pre
        key={key}
        className="
          my-8
          overflow-x-auto
          rounded-xl
          bg-dark
          p-5
          text-sm
          leading-6
          text-light
        "
      >
        <code>
          {code}
        </code>
      </pre>
    );
  }

  /* ----------------------------------------------------------
     HORIZONTAL RULE
  ---------------------------------------------------------- */

  if (
    node.type ===
    "horizontalRule"
  ) {
    return (
      <hr
        key={key}
        className="
          my-10
          border-dark/20
        "
      />
    );
  }

  /* ----------------------------------------------------------
     IMAGE
  ---------------------------------------------------------- */

  if (
    node.type === "image"
  ) {
    return (
      <figure
        key={key}
        className="my-8"
      >
        <img
          src={
            node.attrs?.src
          }
          alt={
            node.attrs?.alt ||
            "Blog image"
          }
          title={
            node.attrs?.title ||
            undefined
          }
          className="
            block
            h-auto
            w-full
            rounded-xl
            object-cover
          "
        />

        {node.attrs?.alt && (
          <figcaption
            className="
              mt-2
              text-center
              text-sm
              opacity-50
            "
          >
            {
              node.attrs.alt
            }
          </figcaption>
        )}
      </figure>
    );
  }

  /* ----------------------------------------------------------
     FALLBACK
  ---------------------------------------------------------- */

  if (
    node.content
  ) {
    return (
      <div key={key}>
        {node.content.map(
          (
            child,
            childIndex
          ) => (
            <RenderNode
              key={`${key}-${childIndex}`}
              node={child}
              index={
                childIndex
              }
            />
          )
        )}
      </div>
    );
  }

  return null;
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

const RenderSupabasePost = ({
  content,
}) => {
  let parsed = null;

  try {
    parsed =
      typeof content ===
      "string"
        ? JSON.parse(content)
        : content;
  } catch (error) {
    console.error(
      "Could not parse Supabase post content:",
      error
    );

    return (
      <div
        className="
          col-span-12
          lg:col-span-8
          font-in
        "
      >
        <p className="text-red-600">
          Unable to render this post.
        </p>
      </div>
    );
  }

  /* ==========================================================
     SUPPORT OLD FORMAT
  ========================================================== */

  const document =
    parsed?.document ||
    parsed;

  const footnotes =
    Array.isArray(
      parsed?.footnotes
    )
      ? parsed.footnotes
      : [];

  if (
    !document ||
    document.type !==
      "doc"
  ) {
    return (
      <div
        className="
          col-span-12
          lg:col-span-8
          font-in
        "
      >
        <p>
          Unable to render this post.
        </p>
      </div>
    );
  }

  /* ==========================================================
     POST
  ========================================================== */

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

      {/* ======================================================
          ARTICLE CONTENT
      ======================================================= */}

      <div>
        {document.content?.map(
          (
            node,
            index
          ) => (
            <RenderNode
              key={`${node.type}-${index}`}
              node={node}
              index={index}
            />
          )
        )}
      </div>

      {/* ======================================================
          FOOTNOTES
      ======================================================= */}

      {footnotes.length >
        0 && (
        <section
          className="
            mt-16
            border-t
            border-dark/20
            pt-8
          "
        >

          <h2
            className="
              mb-6
              text-xl
              font-semibold
            "
          >
            Footnotes
          </h2>

          <ol
            className="
              m-0
              list-none
              space-y-4
              p-0
            "
          >

            {footnotes.map(
              (
                footnote,
                index
              ) => (
                <li
                  key={`${footnote.id}-${index}`}
                  className="
                    flex
                    items-start
                    gap-3
                    text-sm
                    leading-6
                  "
                >

                  <span
                    className="
                      shrink-0
                      font-semibold
                    "
                  >
                    {index + 1}.
                  </span>

                  <div
                    className="
                      min-w-0
                      [&_strong]:font-bold
                      [&_b]:font-bold
                      [&_em]:italic
                      [&_i]:italic
                      [&_u]:underline
                    "
                    dangerouslySetInnerHTML={{
                      __html:
                        footnote.html ||
                        footnote.text ||
                        "",
                    }}
                  />

                </li>
              )
            )}

          </ol>

        </section>
      )}

    </div>
  );
};

export default RenderSupabasePost;