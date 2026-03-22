import { blogs as allBlogs } from "@/.velite/generated";
import BlogLayoutThree from "@/src/components/Blog/BlogLayoutThree";
import Categories from "@/src/components/Blog/Categories";

// Clean, stateless helper function to replace github-slugger
const generateSlug = (tag) => tag.toLowerCase().trim().replace(/\s+/g, '-');

export async function generateStaticParams() {
  const categories = [];
  const paths = [{ slug: "all" }];

  allBlogs.map((blog) => {
    if (blog.isPublished) {
      blog.tags.map((tag) => {
        let slugified = generateSlug(tag); // Use the stateless helper
        if (!categories.includes(slugified)) {
          categories.push(slugified);
          paths.push({ slug: slugified });
        }
      });
    }
  });

  return paths;
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

  const otherCategories = [];
  
  // Gather all categories except "all"
  allBlogs.forEach(blog => {
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

  // Filter the blogs by category, THEN sort them by date (newest to oldest)
  const blogs = allBlogs.filter(blog => {
    if (slugified === "all") return true;
    return blog.tags.some(tag => generateSlug(tag) === slugified); 
  }).sort((a, b) => {
    // We create Date objects from your Velite date field to compare them
    // It checks for 'date', 'publishedAt', or 'createdAt' fields
    const dateA = new Date(a.date || a.publishedAt || a.createdAt);
    const dateB = new Date(b.date || b.publishedAt || b.createdAt);
    return dateB.getTime() - dateA.getTime(); 
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