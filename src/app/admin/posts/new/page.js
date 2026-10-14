"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { getUserRole } from "@/src/lib/admin/permissions";
import RichTextEditor from "@/src/components/Admin/RichTextEditor";
import PostAccessManager from "@/src/components/Admin/PostAccessManager";
import { slugify } from "@/src/lib/forms";

/* ============================================================
   SLUG
============================================================ */

const generateSlug = slugify;

export default function NewPostPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

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

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [collaboratorIds, setCollaboratorIds] =
    useState([]);

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

  const [loadingAction, setLoadingAction] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data: userData }) => {
      if (mounted && userData.user) {
        setIsAdmin(getUserRole(userData.user) === "admin");
      }
    });

    return () => {
      mounted = false;
    };
  }, [supabase]);

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

    setLoadingAction(publish ? "publish" : "save");

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

        setLoadingAction(null);

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

      const createResponse = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim(),
          content,
          author: author.trim() || userData.user.email,
          tags: tagArray,
          image_url: publicUrl,
          is_published: publish,
        }),
      });
      const createResult = await createResponse.json().catch(() => ({}));
      const insertedPost = createResult.post;
      const insertError = createResponse.ok
        ? null
        : { message: createResult.error, code: createResult.code };

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

        setLoadingAction(null);

        return;
      }

      const accessResponses = await Promise.all(
        collaboratorIds.map((editorUserId) =>
          fetch(`/api/admin/posts/${insertedPost.id}/access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ editorUserId }),
          })
        )
      );

      const failedAccess = accessResponses.find((response) => !response.ok);
      if (failedAccess) {
        setError("Post created, but collaborator access could not be saved.");
        setLoadingAction(null);
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

      setLoadingAction(null);
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
                setSlug(slugify(event.target.value))
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

          {isAdmin && (
            <section className="rounded-xl border border-dark/15 p-5">
              <h2 className="text-lg font-semibold">Post access</h2>
              <p className="mb-4 mt-1 text-sm opacity-60">Choose which editors can access this post.</p>
              <PostAccessManager
                selectedEditorIds={collaboratorIds}
                onSelectionChange={setCollaboratorIds}
              />
            </section>
          )}

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
              disabled={loadingAction !== null}
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
              {loadingAction === "save"
                ? "Saving..."
                : "Save Draft"}
            </button>

            {/* PUBLISH */}

            <button
              type="button"
              disabled={loadingAction !== null}
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
              {loadingAction === "publish"
                ? "Publishing..."
                : "Publish"}
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}