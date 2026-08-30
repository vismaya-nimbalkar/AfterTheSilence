"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import RichTextEditor from "@/src/components/Admin/RichTextEditor";

/* ============================================================
   SLUG
============================================================ */

const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

/* ============================================================
   PREVIEW HELPERS
============================================================ */

function parseEditorContent(content) {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content);

    if (
      parsed?.document?.type === "doc"
    ) {
      return parsed;
    }

    if (
      parsed?.type === "doc"
    ) {
      return {
        document: parsed,
        footnotes: [],
      };
    }

    return null;
  } catch {
    return null;
  }
}

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
        <s>
          {result}
        </s>
      );
    }

    if (mark.type === "code") {
      result = (
        <code className="rounded bg-dark/10 px-1.5 py-0.5 font-mono text-[0.9em]">
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
          href={mark.attrs?.href || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {result}
        </a>
      );
    }
  });

  return result;
}

/* ============================================================
   PREVIEW INLINE CONTENT
============================================================ */

function PreviewInlineContent({
  content = [],
}) {
  return (
    <>
      {content.map((node, index) => {
        const key =
          `${node.type}-${node.attrs?.id || ""}-${index}`;

        if (
          node.type === "text"
        ) {
          return (
            <span key={key}>
              {renderMarks(
                node.text,
                node.marks
              )}
            </span>
          );
        }

        if (
          node.type ===
          "hardBreak"
        ) {
          return (
            <br key={key} />
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
                cursor-default
                select-none
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
              className="
                my-6
                h-auto
                w-full
                rounded-xl
                object-cover
              "
            />
          );
        }

        return null;
      })}
    </>
  );
}

/* ============================================================
   PREVIEW NODE
============================================================ */

function PreviewNode({
  node,
  index,
}) {
  if (!node) {
    return null;
  }

  const key =
    `${node.type}-${node.attrs?.id || ""}-${index}`;

  if (
    node.type === "paragraph"
  ) {
    return (
      <p
        key={key}
        className="mb-6 leading-8"
      >
        <PreviewInlineContent
          content={
            node.content
          }
        />
      </p>
    );
  }

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
          "
        >
          <PreviewInlineContent
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
          <PreviewInlineContent
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
        <PreviewInlineContent
          content={
            node.content
          }
        />
      </h3>
    );
  }

  if (
    node.type ===
    "blockquote"
  ) {
    return (
      <blockquote
        key={key}
        className="
          my-8
          rounded-r-xl
          border-l-4
          border-accent
          bg-accent/10
          px-6
          py-4
          italic
        "
      >
        {node.content?.map(
          (child, childIndex) => (
            <PreviewNode
              key={`${key}-${childIndex}`}
              node={child}
              index={childIndex}
            />
          )
        )}
      </blockquote>
    );
  }

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
          (child, childIndex) => (
            <PreviewNode
              key={`${key}-${childIndex}`}
              node={child}
              index={childIndex}
            />
          )
        )}
      </ul>
    );
  }

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
          (child, childIndex) => (
            <PreviewNode
              key={`${key}-${childIndex}`}
              node={child}
              index={childIndex}
            />
          )
        )}
      </ol>
    );
  }

  if (
    node.type === "listItem"
  ) {
    return (
      <li
        key={key}
        className="leading-7"
      >
        {node.content?.map(
          (child, childIndex) => (
            <PreviewNode
              key={`${key}-${childIndex}`}
              node={child}
              index={childIndex}
            />
          )
        )}
      </li>
    );
  }

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

  if (
    node.type ===
    "horizontalRule"
  ) {
    return (
      <hr
        key={key}
        className="my-10 border-dark/20"
      />
    );
  }

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
            h-auto
            w-full
            rounded-xl
            object-cover
          "
        />

        {node.attrs?.alt && (
          <figcaption className="mt-2 text-center text-sm opacity-50">
            {node.attrs.alt}
          </figcaption>
        )}
      </figure>
    );
  }

  if (
    node.type === "text"
  ) {
    return (
      <span key={key}>
        {renderMarks(
          node.text,
          node.marks
        )}
      </span>
    );
  }

  return (
    <div key={key}>
      {node.content?.map(
        (child, childIndex) => (
          <PreviewNode
            key={`${key}-${childIndex}`}
            node={child}
            index={childIndex}
          />
        )
      )}
    </div>
  );
}

/* ============================================================
   FINAL POST PREVIEW
============================================================ */

function FinalPostPreview({
  title,
  description,
  author,
  tags,
  imagePreview,
  content,
}) {
  const parsed =
    parseEditorContent(
      content
    );

  const document =
    parsed?.document;

  const footnotes =
    parsed?.footnotes || [];

  const hasContent =
    document?.content?.length >
    0;

  return (
    <section className="overflow-hidden rounded-2xl border border-dark/20 bg-transparent">

      {/* PREVIEW HEADER */}

      <div className="flex items-center justify-between border-b border-dark/10 bg-dark/[0.03] px-5 py-4">

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] opacity-50">
            Final Post Preview
          </p>

          <p className="mt-1 text-sm opacity-40">
            This is approximately how your published post will look.
          </p>
        </div>

        <div className="rounded-full border border-dark/10 px-3 py-1 text-xs opacity-50">
          Live Preview
        </div>

      </div>

      {/* ARTICLE */}

      <article className="mx-auto max-w-3xl px-6 py-12 sm:px-10">

        {/* COVER */}

        {imagePreview && (
          <div className="mb-10 overflow-hidden rounded-2xl">
            <img
              src={imagePreview}
              alt={
                title ||
                "Post cover"
              }
              className="
                aspect-video
                w-full
                object-cover
              "
            />
          </div>
        )}

        {/* TITLE */}

        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          {title ||
            "Your post title"}
        </h1>

        {/* DESCRIPTION */}

        {description ? (
          <p className="mt-5 text-lg leading-8 opacity-60">
            {description}
          </p>
        ) : (
          <p className="mt-5 text-lg leading-8 opacity-30">
            Your post description will appear here.
          </p>
        )}

        {/* META */}

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm opacity-50">

          <span>
            {author ||
              "Author"}
          </span>

          <span>
            ·
          </span>

          <span>
            {new Date().toLocaleDateString(
              undefined,
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              }
            )}
          </span>

        </div>

        {/* TAGS */}

        {tags && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags
              .split(",")
              .map(
                (tag) =>
                  tag.trim()
              )
              .filter(Boolean)
              .map(
                (
                  tag,
                  index
                ) => (
                  <span
                    key={`${tag}-${index}`}
                    className="
                      rounded-full
                      border
                      border-dark/10
                      px-3
                      py-1
                      text-xs
                      opacity-60
                    "
                  >
                    {tag}
                  </span>
                )
              )}
          </div>
        )}

        {/* DIVIDER */}

        <div className="my-10 border-t border-dark/10" />

        {/* CONTENT */}

        {!hasContent ? (

          <div className="rounded-xl border border-dashed border-dark/20 px-6 py-12 text-center">

            <p className="text-sm opacity-40">
              Start writing in the editor above to see your finished post here.
            </p>

          </div>

        ) : (

          <div className="font-in text-[17px]">

            {document.content.map(
              (
                node,
                index
              ) => (
                <PreviewNode
                  key={`${node.type}-${index}`}
                  node={node}
                  index={index}
                />
              )
            )}

          </div>

        )}

        {/* FOOTNOTES */}

        {footnotes.length >
          0 && (
          <div className="mt-14 border-t border-dark/20 pt-8">

            <h2 className="mb-6 text-lg font-semibold">
              Footnotes
            </h2>

            <div className="space-y-4">

              {footnotes.map(
                (
                  footnote,
                  index
                ) => (
                  <div
                    key={`${footnote.id}-${index}`}
                    className="flex items-start gap-3 text-sm leading-6"
                  >

                    <span className="shrink-0 font-semibold">
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

                  </div>
                )
              )}

            </div>

          </div>
        )}

      </article>

    </section>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default function NewPostPage() {
  const router = useRouter();
  const supabase = createClient();

  /* ==========================================================
     FORM STATE
  ========================================================== */

  const [title, setTitle] =
    useState("");

  const [slug, setSlug] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [author, setAuthor] =
    useState("");

  const [tags, setTags] =
    useState("");

  const [content, setContent] =
    useState("");

  /* ==========================================================
     IMAGE STATE
  ========================================================== */

  const [imageFile, setImageFile] =
    useState(null);

  const [imagePreview, setImagePreview] =
    useState("");

  /* ==========================================================
     UI STATE
  ========================================================== */

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  /* ==========================================================
     TITLE / SLUG
  ========================================================== */

  const handleTitleChange = (
    event
  ) => {
    const value =
      event.target.value;

    setTitle(value);

    if (
      !slug ||
      slug ===
        generateSlug(title)
    ) {
      setSlug(
        generateSlug(value)
      );
    }
  };

  /* ==========================================================
     IMAGE
  ========================================================== */

  const handleImageChange = (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setError(
        "Please choose an image smaller than 10 MB."
      );

      return;
    }

    setError("");
    setImageFile(file);

    const previewUrl =
      URL.createObjectURL(
        file
      );

    setImagePreview(
      previewUrl
    );
  };

  /* ==========================================================
     SAVE / PUBLISH
  ========================================================== */

  const savePost = async (
    publish
  ) => {
    setError("");
    setMessage("");

    /* --------------------------------------------------------
       VALIDATION
    -------------------------------------------------------- */

    if (!title.trim()) {
      setError(
        "Please enter a title."
      );

      return;
    }

    if (!slug.trim()) {
      setError(
        "Please enter a slug."
      );

      return;
    }

    if (!content.trim()) {
      setError(
        "Please write some content."
      );

      return;
    }

    if (!imageFile) {
      setError(
        "Please choose a cover image."
      );

      return;
    }

    setLoading(true);

    try {
      const now =
        new Date().toISOString();

      /* ------------------------------------------------------
         TAGS
      ------------------------------------------------------ */

      const tagArray =
        tags
          .split(",")
          .map((tag) =>
            tag.trim()
          )
          .filter(Boolean);

      /* ------------------------------------------------------
         CHECK AUTHENTICATION
      ------------------------------------------------------ */

      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !userData.user
      ) {
        router.push(
          "/admin/login"
        );

        return;
      }

      /* ------------------------------------------------------
         UPLOAD COVER IMAGE
      ------------------------------------------------------ */

      const fileExtension =
        imageFile.name
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "jpg";

      const fileName =
        `${crypto.randomUUID()}.${fileExtension}`;

      const filePath =
        `covers/${fileName}`;

      const {
        error: uploadError,
      } =
        await supabase.storage
          .from("blog-images")
          .upload(
            filePath,
            imageFile,
            {
              cacheControl:
                "3600",

              upsert:
                false,
            }
          );

      if (uploadError) {
        console.error(
          "SUPABASE IMAGE UPLOAD ERROR:",
          uploadError
        );

        setError(
          uploadError.message ||
            "Could not upload the cover image. Please try again."
        );

        setLoading(false);

        return;
      }

      /* ------------------------------------------------------
         GET PUBLIC IMAGE URL
      ------------------------------------------------------ */

      const {
        data: {
          publicUrl,
        },
      } =
        supabase.storage
          .from("blog-images")
          .getPublicUrl(
            filePath
          );

      /* ------------------------------------------------------
         CREATE POST
      ------------------------------------------------------ */

      const {
        error: insertError,
      } =
        await supabase
          .from("posts")
          .insert({
            title:
              title.trim(),

            slug:
              slug.trim(),

            description:
              description.trim(),

            /*
             * RichTextEditor stores the content as
             * serialized Tiptap JSON.
             */
            content,

            author:
              author.trim() ||
              userData.user.email,

            tags: tagArray,

            image_url:
              publicUrl,

            /* ------------------------------------------------
               EXPLICIT ACTION
            ------------------------------------------------ */

            is_published:
              publish,

            published_at:
              publish
                ? now
                : null,

            updated_at:
              now,
          });

      /* ------------------------------------------------------
         DATABASE ERROR
      ------------------------------------------------------ */

      if (insertError) {
        console.error(
          "SUPABASE POST INSERT ERROR:",
          insertError
        );

        if (
          insertError.code ===
          "23505"
        ) {
          setError(
            "A post with this slug already exists. Please choose another slug."
          );
        } else {
          setError(
            insertError.message ||
              "Could not create the post."
          );
        }

        setLoading(false);

        return;
      }

      /* ------------------------------------------------------
         SUCCESS
      ------------------------------------------------------ */

      setMessage(
        publish
          ? "Post published successfully!"
          : "Draft saved successfully!"
      );

      setTimeout(() => {
        router.push(
          "/admin"
        );

        router.refresh();
      }, 1000);

    } catch (err) {
      console.error(
        "UNEXPECTED ERROR:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  };

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">

      <div className="mx-auto max-w-6xl">

        {/* ====================================================
            HEADER
        ===================================================== */}

        <div className="mb-10 flex items-center justify-between">

          <div>

            <p className="text-sm opacity-60">
              After The Silence
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              New Post
            </h1>

          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin"
              )
            }
            className="
              rounded-lg
              border
              border-dark/20
              px-4
              py-2
              text-sm
              transition-colors
              hover:bg-dark
              hover:text-light
            "
          >
            ← Back
          </button>

        </div>

        {/* ====================================================
            FORM
        ===================================================== */}

        <div className="space-y-8">

          {/* ==================================================
              TITLE
          =================================================== */}

          <div>

            <label
              htmlFor="title"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Title
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={
                handleTitleChange
              }
              placeholder="Your post title"
              className="
                w-full
                rounded-lg
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

          {/* ==================================================
              SLUG
          =================================================== */}

          <div>

            <label
              htmlFor="slug"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Slug
            </label>

            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(event) =>
                setSlug(
                  event.target.value
                )
              }
              placeholder="your-post-slug"
              className="
                w-full
                rounded-lg
                border
                border-dark/20
                bg-transparent
                px-4
                py-3
                outline-none
                focus:border-dark
              "
            />

            <p className="mt-2 text-sm opacity-50">

              Your post will appear at:{" "}

              <span className="font-mono">
                /blogs/
                {slug ||
                  "your-post-slug"}
              </span>

            </p>

          </div>

          {/* ==================================================
              DESCRIPTION
          =================================================== */}

          <div>

            <label
              htmlFor="description"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Description
            </label>

            <textarea
              id="description"
              value={
                description
              }
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="A short description of your post..."
              rows={3}
              className="
                w-full
                resize-y
                rounded-lg
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

          {/* ==================================================
              AUTHOR
          =================================================== */}

          <div>

            <label
              htmlFor="author"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Author
            </label>

            <input
              id="author"
              type="text"
              value={author}
              onChange={(event) =>
                setAuthor(
                  event.target.value
                )
              }
              placeholder="Vismaya Nimbalkar"
              className="
                w-full
                rounded-lg
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

          {/* ==================================================
              TAGS
          =================================================== */}

          <div>

            <label
              htmlFor="tags"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Tags
            </label>

            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(event) =>
                setTags(
                  event.target.value
                )
              }
              placeholder="queer, identity, life"
              className="
                w-full
                rounded-lg
                border
                border-dark/20
                bg-transparent
                px-4
                py-3
                outline-none
                focus:border-dark
              "
            />

            <p className="mt-2 text-sm opacity-50">
              Separate tags with commas.
            </p>

          </div>

          {/* ==================================================
              COVER IMAGE
          =================================================== */}

          <div>

            <label
              htmlFor="cover-image"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Cover Image
            </label>

            <div
              className="
                rounded-xl
                border
                border-dashed
                border-dark/30
                p-6
              "
            >

              <input
                id="cover-image"
                type="file"
                accept="
                  image/jpeg,
                  image/png,
                  image/webp
                "
                onChange={
                  handleImageChange
                }
                className="
                  block
                  w-full
                  text-sm
                "
              />

              <p className="mt-3 text-sm opacity-50">
                JPG, PNG or WebP.
                Maximum 10 MB.
              </p>

              {imagePreview && (
                <div
                  className="
                    mt-6
                    overflow-hidden
                    rounded-xl
                    border
                    border-dark/20
                  "
                >

                  <img
                    src={
                      imagePreview
                    }
                    alt="Cover preview"
                    className="
                      aspect-video
                      w-full
                      object-cover
                    "
                  />

                </div>
              )}

            </div>

          </div>

          {/* ==================================================
              RICH TEXT CONTENT EDITOR
          =================================================== */}

          <div>

            <div className="mb-3">

              <label
                className="
                  block
                  text-sm
                  font-medium
                "
              >
                Content
              </label>

              <p
                className="
                  mt-1
                  text-sm
                  opacity-50
                "
              >
                Write your article using the formatting tools below.
              </p>

            </div>

            <RichTextEditor
              value={content}
              onChange={setContent}
            />

          </div>

          {/* ==================================================
              LIVE FINAL POST PREVIEW
          =================================================== */}

          <FinalPostPreview
            title={title}
            description={
              description
            }
            author={author}
            tags={tags}
            imagePreview={
              imagePreview
            }
            content={content}
          />

          {/* ==================================================
              ERROR
          =================================================== */}

          {error && (
            <div
              className="
                rounded-lg
                border
                border-red-500/30
                bg-red-500/10
                px-4
                py-3
                text-sm
                text-red-600
              "
            >
              {error}
            </div>
          )}

          {/* ==================================================
              SUCCESS
          =================================================== */}

          {message && (
            <div
              className="
                rounded-lg
                border
                border-green-500/30
                bg-green-500/10
                px-4
                py-3
                text-sm
                text-green-700
              "
            >
              {message}
            </div>
          )}

          {/* ==================================================
              ACTION BUTTONS
          =================================================== */}

          <div
            className="
              flex
              flex-col
              gap-4
              border-t
              border-dark/10
              pt-6
              sm:flex-row
            "
          >

            {/* SAVE DRAFT */}

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                savePost(false)
              }
              className="
                rounded-lg
                border
                border-dark
                px-6
                py-3
                font-medium
                transition-opacity
                hover:opacity-70
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {loading
                ? "Saving..."
                : "Save Draft"}
            </button>

            {/* PUBLISH */}

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                savePost(true)
              }
              className="
                rounded-lg
                bg-dark
                px-6
                py-3
                font-medium
                text-light
                transition-opacity
                hover:opacity-80
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {loading
                ? "Publishing..."
                : "Publish"}
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}