import { blogs } from "@/.velite/generated";
import HomeCoverSection from "../components/Home/HomeCoverSection";
import FeaturedPosts from "../components/Home/FeaturedPosts";
import RecentPosts from "../components/Home/RecentPosts";
import { createClient } from "@/src/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: supabasePosts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("is_published", true)
    .order("published_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Error loading Supabase posts:",
      error
    );
  }

  /*
   * Convert Supabase posts into the same
   * structure used by your existing Velite posts.
   */

  const formattedSupabasePosts = (
    supabasePosts || []
  ).map((post) => {
    const content = post.content || "";

    const wordCount = content
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    const readingMinutes = Math.max(
      1,
      Math.ceil(wordCount / 200)
    );

    return {
      id: post.id,

      title: post.title,

      slug: post.slug,

      url: `/blogs/${post.slug}`,

      description: post.description || "",

      author: post.author || "",

      tags: Array.isArray(post.tags)
        ? post.tags
        : [],

      publishedAt:
        post.published_at ||
        post.created_at,

      updatedAt:
        post.updated_at ||
        post.published_at ||
        post.created_at,

      isPublished: post.is_published,

      body: post.content || "",

      content: post.content || "",

      readingTime: {
        text: `${readingMinutes} min read`,
        minutes: readingMinutes,
      },

      /*
       * Your existing BlogLayout components
       * expect blog.image.src.
       */

      image: post.image_url
        ? {
            src: post.image_url,
            width: 1200,
            height: 630,
            blurDataURL: "",
          }
        : null,

      image_url: post.image_url,
    };
  });

  /*
   * Combine old MDX posts and new Supabase posts.
   */

  const allBlogs = [
    ...blogs,
    ...formattedSupabasePosts,
  ];

  /*
   * Only show published posts.
   * Then sort newest → oldest.
   */

  const sortedBlogs = allBlogs
    .filter(
      (blog) =>
        blog.isPublished !== false
    )
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );

  return (
    <main className="flex flex-col items-center justify-center">
      <HomeCoverSection blogs={sortedBlogs} />

      <FeaturedPosts blogs={sortedBlogs} />

      <RecentPosts blogs={sortedBlogs} />
    </main>
  );
}