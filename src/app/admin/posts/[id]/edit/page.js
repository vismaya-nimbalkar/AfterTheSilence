"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import RichTextEditor from "@/src/components/Admin/RichTextEditor";

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [imageLabel, setImageLabel] = useState("No cover image selected yet");
  const [isPublished, setIsPublished] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadPost() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/admin/login");
        return;
      }

      const { data: post, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error || !post) {
        setError("Post could not be found.");
        setLoading(false);
        return;
      }

      setTitle(post.title || "");
      setSlug(post.slug || "");
      setDescription(post.description || "");
      setContent(post.content || "");
      setAuthor(post.author || "");
      setTags(
        Array.isArray(post.tags)
          ? post.tags.join(", ")
          : post.tags || ""
      );
      setExistingImageUrl(post.image_url || "");
      setImagePreview(post.image_url || "");
      setImageLabel(
        post.image_url ? "Current cover image selected" : "No cover image selected yet"
      );
      setIsPublished(post.is_published || false);

      setLoading(false);
    }

    loadPost();
  }, [params.id]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Please choose an image smaller than 10 MB.");
      return;
    }

    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageLabel(`Selected: ${file.name}`);
  };

  const handleSave = async (publish) => {
    setError("");
    setSaving(true);

    const tagArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    let nextImageUrl = existingImageUrl || null;

    try {
      if (imageFile) {
        const fileExtension =
          imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

        const fileName = `${crypto.randomUUID()}.${fileExtension}`;
        const filePath = `covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("blog-images")
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            uploadError.message || "Could not upload the cover image."
          );
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("blog-images").getPublicUrl(filePath);

        nextImageUrl = publicUrl;
      }
    } catch (uploadErr) {
      console.error(uploadErr);
      setError(uploadErr.message || "Could not save the cover image.");
      setSaving(false);
      return;
    }

    const updateData = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      content,
      author: author.trim(),
      tags: tagArray,
      image_url: nextImageUrl,
      is_published: publish,
      updated_at: new Date().toISOString(),
    };

    if (publish) {
      updateData.published_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("posts")
      .update(updateData)
      .eq("id", params.id);

    if (error) {
      console.error(error);
      setError("Could not save the post.");
      setSaving(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="opacity-60">
          Loading post...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-4xl">

        <button
          onClick={() => router.push("/admin")}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← Back to Dashboard
        </button>

        <h1 className="mt-8 text-4xl font-bold">
          Edit Post
        </h1>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">
            {error}
          </div>
        )}

        <div className="mt-10 space-y-6">

          <div>
            <label className="mb-2 block text-sm font-medium">
              Title
            </label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Slug
            </label>

            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
            />

            <p className="mt-2 text-sm opacity-50">
              /blogs/{slug}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Author
            </label>

            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Tags
            </label>

            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="queer, legal, university"
              className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
            />
          </div>

          <div className="rounded-2xl border border-dark/20 p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label className="block text-sm font-medium">
                  Cover Image
                </label>
                <p className="mt-1 text-sm opacity-60">{imageLabel}</p>
              </div>

              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dark/20 bg-dark px-4 py-2 text-sm font-medium text-light transition-opacity hover:opacity-80">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  className="hidden"
                />
                Change image
              </label>
            </div>

            <p className="mb-4 text-sm opacity-50">
              JPG, PNG or WebP. Maximum 10 MB.
            </p>

            {imagePreview && (
              <div className="overflow-hidden rounded-xl border border-dark/20">
                <img
                  src={imagePreview}
                  alt="Cover preview"
                  className="aspect-video w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-dark/20 p-4">
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Content
              </label>
              <p className="mt-1 text-sm opacity-50">
                Write your article using the formatting tools below.
              </p>
            </div>

            <RichTextEditor value={content} onChange={setContent} />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="published"
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />

            <label htmlFor="published">
              Published
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="rounded-lg border border-dark/20 px-6 py-3 font-medium hover:bg-dark/5 disabled:opacity-50"
            >
              Save Draft
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="rounded-lg bg-dark px-6 py-3 font-medium text-light hover:opacity-80 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Publish"}
            </button>

          </div>

        </div>

      </div>
    </main>
  );
}