import { blogs as veliteBlogs } from "@/.velite/generated";
import BlogLayoutThree from "@/src/components/Blog/BlogLayoutThree";
import Categories from "@/src/components/Blog/Categories";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

// Clean, stateless helper function to replace github-slugger
const generateSlug = (tag) => tag.toLowerCase().trim().replace(/\s+/g, '-');

async function getPublishedSupabaseBlogs() {
  const supabase = await createClient();

  const { data: supabasePosts } = await supabase
    .from("posts")
    .select("*")
    .eq("is_published", true)
    .order("published_at", {
      ascending: false,
    });

  return (supabasePosts || []).map((post) => {
    const content = post.content || "";
    const wordCount = content
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      url: `/blogs/${post.slug}`,
      description: post.description || "",
      author: post.author || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
      publishedAt: post.published_at || post.created_at,
      updatedAt: post.updated_at || post.published_at || post.created_at,
      isPublished: post.is_published,
      body: post.content || "",
      content: post.content || "",
      readingTime: {
        text: `${Math.max(1, Math.ceil(wordCount / 200))} min read`,
        minutes: Math.max(1, Math.ceil(wordCount / 200)),
      },
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
}

export async function generateMetadata({ params }) {
  const { slug } = await params;  // Await params before accessing slug
  const slugified = slug || 'all';  // Safe access
  return {
    title: `${slugified.replaceAll("-", " ")} Blogs`,
    description: `Learn more about ${slugified === "all" ? "web development" : slugified} through our collection of expert blogs and tutorials`,
  };
}

const CategoryPage = async ({ params }) => {
  const { slug } = await params;  // Await params before accessing slug
  const slugified = slug || 'all';  // Safe access

  const supabaseBlogs = await getPublishedSupabaseBlogs();
  const allBlogs = [...supabaseBlogs, ...veliteBlogs].filter((blog) => blog && blog.isPublished !== false);

  const otherCategories = [];

  // Gather all categories except "all"
  allBlogs.forEach(blog => {
    if (!Array.isArray(blog.tags)) return;

    blog.tags.forEach(tag => {
      const slugifiedTag = generateSlug(tag);  // Use the stateless helper
      if (slugifiedTag !== "all" && !otherCategories.includes(slugifiedTag)) {
        otherCategories.push(slugifiedTag);
      }
    });
  });

  // Sort the other categories alphabetically
  otherCategories.sort();

  // Force "all" to be the very first item, followed by the sorted rest
  const allCategories = ["all", ...otherCategories];

  // Filter the blogs by category, THEN sort them by date (oldest to newest)
  const blogs = allBlogs.filter(blog => {
    if (slugified === "all") return true;
    if (!Array.isArray(blog.tags)) return false;
    return blog.tags.some(tag => generateSlug(tag) === slugified); 
  }).sort((a, b) => {
    const dateA = new Date(a.date || a.publishedAt || a.createdAt || a.updatedAt || 0);
    const dateB = new Date(b.date || b.publishedAt || b.createdAt || b.updatedAt || 0);
    return dateA.getTime() - dateB.getTime(); // Updated to sort Oldest to Newest
  });

  return (
    <article className="mt-12 flex flex-col text-dark dark:text-light">
      <div className="px-5 sm:px-10 md:px-24 sxl:px-32 flex flex-col">
        <h1 className="mt-6 font-semibold text-2xl md:text-4xl lg:text-5xl">#{slugified}</h1>
        <span className="mt-2 inline-block">
          Discover more categories and expand your knowledge!
        </span>
      </div>
      <Categories categories={allCategories} currentSlug={slugified} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-16 mt-5 sm:mt-10 md:mt-24 sxl:mt-32 px-5 sm:px-10 md:px-24 sxl:px-32">
        {blogs.map((blog, index) => (
          <article key={index} className="col-span-1 row-span-1 relative">
            <BlogLayoutThree blog={blog} />
          </article>
        ))}
      </div>
    </article>
  );
};

export default CategoryPage;