"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

export default function NewPostPage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [isPublished, setIsPublished] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleTitleChange = (event) => {
    const value = event.target.value;

    setTitle(value);

    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(value));
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Please choose an image smaller than 10 MB.");
      return;
    }

    setError("");
    setImageFile(file);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const savePost = async (publish) => {
    setError("");
    setMessage("");

    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    if (!slug.trim()) {
      setError("Please enter a slug.");
      return;
    }

    if (!content.trim()) {
      setError("Please write some content.");
      return;
    }

    if (!imageFile) {
      setError("Please choose a cover image.");
      return;
    }

    setLoading(true);

    try {
      const now = new Date().toISOString();

      const tagArray = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/admin/login");
        return;
      }

      /*
       * Upload cover image to Supabase Storage
       */

      const fileExtension =
        imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const fileName = `${crypto.randomUUID()}.${fileExtension}`;

      const filePath = `covers/${fileName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("blog-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

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

      /*
       * Get public URL for uploaded image
       */

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("blog-images")
        .getPublicUrl(filePath);

      /*
       * Create post in Supabase
       */

      const { error: insertError } = await supabase
        .from("posts")
        .insert({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim(),
          content,
          author: author.trim() || userData.user.email,
          tags: tagArray,
          image_url: publicUrl,
          is_published: publish,
          published_at: publish ? now : null,
          updated_at: now,
        });

      if (insertError) {
        console.error(
          "SUPABASE POST INSERT ERROR:",
          insertError
        );

        if (insertError.code === "23505") {
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

      setMessage(
        publish
          ? "Post published successfully!"
          : "Draft saved successfully!"
      );

      setTimeout(() => {
        router.push("/admin");
        router.refresh();
      }, 1000);

    } catch (err) {
      console.error("UNEXPECTED ERROR:", err);

      setError(
        err?.message ||
          "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">

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
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-dark/20 px-4 py-2 text-sm hover:bg-dark hover:text-light transition-colors"
          >
            ← Back
          </button>

        </div>

        {/* Form */}
        <div className="space-y-8">

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium mb-2"
            >
              Title
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Your post title"
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none focus:border-dark"
            />
          </div>

          {/* Slug */}
          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium mb-2"
            >
              Slug
            </label>

            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(event) =>
                setSlug(event.target.value)
              }
              placeholder="your-post-slug"
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none focus:border-dark"
            />

            <p className="mt-2 text-sm opacity-50">
              Your post will appear at:
              {" "}
              /blogs/{slug || "your-post-slug"}
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-2"
            >
              Description
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="A short description of your post..."
              rows={3}
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none focus:border-dark resize-y"
            />
          </div>

          {/* Author */}
          <div>
            <label
              htmlFor="author"
              className="block text-sm font-medium mb-2"
            >
              Author
            </label>

            <input
              id="author"
              type="text"
              value={author}
              onChange={(event) =>
                setAuthor(event.target.value)
              }
              placeholder="Vismaya Nimbalkar"
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none focus:border-dark"
            />
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="tags"
              className="block text-sm font-medium mb-2"
            >
              Tags
            </label>

            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(event) =>
                setTags(event.target.value)
              }
              placeholder="queer, identity, life"
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none focus:border-dark"
            />

            <p className="mt-2 text-sm opacity-50">
              Separate tags with commas.
            </p>
          </div>

          {/* Cover Image */}
          <div>

            <label
              htmlFor="cover-image"
              className="block text-sm font-medium mb-2"
            >
              Cover Image
            </label>

            <div className="rounded-xl border border-dashed border-dark/30 p-6">

              <input
                id="cover-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="block w-full text-sm"
              />

              <p className="mt-3 text-sm opacity-50">
                JPG, PNG or WebP. Maximum 10 MB.
              </p>

              {imagePreview && (
                <div className="mt-6 overflow-hidden rounded-xl border border-dark/20">

                  <img
                    src={imagePreview}
                    alt="Cover preview"
                    className="aspect-video w-full object-cover"
                  />

                </div>
              )}

            </div>

          </div>

          {/* Content */}
          <div>

            <label
              htmlFor="content"
              className="block text-sm font-medium mb-2"
            >
              Content
            </label>

            <textarea
              id="content"
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
              placeholder={`# Your post

Start writing here...

## A section

Write your thoughts here.`}
              rows={25}
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-4 font-mono text-sm leading-7 outline-none focus:border-dark resize-y"
            />

            <p className="mt-2 text-sm opacity-50">
              Markdown is supported.
            </p>

          </div>

          {/* Status */}
          <div className="rounded-xl border border-dark/20 p-5">

            <label className="flex items-center gap-3 cursor-pointer">

              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) =>
                  setIsPublished(event.target.checked)
                }
                className="h-4 w-4"
              />

              <span className="font-medium">
                Publish immediately
              </span>

            </label>

            <p className="mt-2 text-sm opacity-60">
              If unchecked, the post will be saved as a draft.
            </p>

          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success */}
          {message && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">

            <button
              type="button"
              disabled={loading}
              onClick={() => savePost(false)}
              className="rounded-lg border border-dark px-6 py-3 font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => savePost(true)}
              className="rounded-lg bg-dark text-light px-6 py-3 font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {loading ? "Publishing..." : "Publish"}
            </button>

          </div>

        </div>
      </div>
    </main>
  );
}