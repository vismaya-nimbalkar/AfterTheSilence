import BlogDetails from "@/src/components/Blog/BlogDetails";
import RenderMdx from "@/src/components/Blog/RenderMdx";
import RenderSupabasePost from "@/src/components/Blog/RenderSupabasePost";
import Tag from "@/src/components/Elements/Tag";
import PostViewCounter from "@/src/components/Blog/PostViewCounter";
import Comments from "@/src/components/Blog/Comments";
import siteMetadata from "@/src/utils/siteMetaData";
import { blogs } from "@/.velite/generated";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const generateSlug = (tag) =>
  tag.toLowerCase().trim().replace(/\s+/g, "-");

function TableOfContentsItem({ item, level = "two" }) {
  return (
    <li className="py-1">
      <a
        href={item.url}
        data-level={level}
        className="
          data-[level=two]:pl-0
          data-[level=two]:pt-2
          data-[level=two]:border-t
          border-solid
          border-dark/40
          data-[level=three]:pl-4
          sm:data-[level=three]:pl-6
          flex
          items-center
          justify-start
        "
      >
        {level === "three" && (
          <span className="flex w-1 h-1 rounded-full bg-dark mr-2">
            &nbsp;
          </span>
        )}

        <span className="hover:underline">
          {item.title}
        </span>
      </a>

      {item.items?.length > 0 && (
        <ul className="mt-1">
          {item.items.map((subItem) => (
            <TableOfContentsItem
              key={subItem.url}
              item={subItem}
              level="three"
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function BlogPage({ params }) {
  const { slug } = await params;

  const supabase = await createClient();

  /*
   * ============================================================
   * SUPABASE POST
   * ============================================================
   */

  const { data: supabasePost } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (supabasePost) {
    const tags = Array.isArray(supabasePost.tags)
      ? supabasePost.tags
      : [];

    const content = supabasePost.content || "";

    const wordCount = content
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    const readingTime = Math.max(
      1,
      Math.ceil(wordCount / 200)
    );

    const publishedDate =
      supabasePost.published_at ||
      supabasePost.created_at ||
      new Date().toISOString();

    const imageUrl =
      typeof supabasePost.image_url === "string" &&
      supabasePost.image_url.trim() !== ""
        ? supabasePost.image_url.trim()
        : null;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: supabasePost.title,
      description: supabasePost.description || "",
      image: imageUrl
        ? [imageUrl]
        : [siteMetadata.socialBanner],
      datePublished: new Date(
        publishedDate
      ).toISOString(),
      dateModified: new Date(
        supabasePost.updated_at || publishedDate
      ).toISOString(),
      author: [
        {
          "@type": "Person",
          name:
            supabasePost.author ||
            siteMetadata.author,
        },
      ],
      url: `${siteMetadata.siteUrl}/blogs/${supabasePost.slug}`,
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />

        <article>

          {/* ==================================================
              HERO
          =================================================== */}

          <div className="mb-8 text-center relative w-full h-[70vh] bg-dark overflow-hidden">

            {/* Cover Image */}
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={supabasePost.title || "Blog cover"}
                className="
                  absolute
                  inset-0
                  w-full
                  h-full
                  object-cover
                  object-center
                  z-0
                "
              />
            ) : (
              <div className="absolute inset-0 bg-dark z-0" />
            )}

            {/* Overlay */}
            <div
              className="
                absolute
                inset-0
                bg-dark/60
                dark:bg-dark/40
                z-10
              "
            />

            {/* Hero Text */}
            <div
              className="
                w-full
                z-20
                flex
                flex-col
                items-center
                justify-center
                absolute
                top-1/2
                left-1/2
                -translate-x-1/2
                -translate-y-1/2
              "
            >

              {tags.length > 0 && (
                <Tag
                  name={tags[0]}
                  link={`/categories/${generateSlug(tags[0])}`}
                  className="px-6 text-sm py-2"
                />
              )}

              <h1
                className="
                  inline-block
                  mt-6
                  font-semibold
                  capitalize
                  text-light
                  text-2xl
                  md:text-3xl
                  lg:text-5xl
                  !leading-normal
                  relative
                  w-5/6
                "
              >
                {supabasePost.title}
              </h1>

              {supabasePost.description && (
                <p
                  className="
                    mt-4
                    text-light
                    text-base
                    md:text-lg
                    w-5/6
                    max-w-3xl
                  "
                >
                  {supabasePost.description}
                </p>
              )}

            </div>
          </div>

          {/* ==================================================
              POST DETAILS
          =================================================== */}

          <div
            className="
              px-6
              md:px-10
              py-4
              md:py-5
              bg-accent
              dark:bg-accentDark
              text-light
              dark:text-dark
              grid
              grid-cols-1
              sm:grid-cols-2
              md:grid-cols-5
              items-center
              text-lg
              sm:text-xl
              font-medium
              mx-5
              md:mx-10
              rounded-lg
              gap-y-4
            "
          >

            {/* Date */}
            <time className="whitespace-nowrap text-left">
              {new Date(
                publishedDate
              ).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>

            {/* Author */}
            {supabasePost.author && (
              <span
                className="
                  whitespace-nowrap
                  text-center
                  md:text-left
                "
              >
                {supabasePost.author}
              </span>
            )}

            {/* Reading Time */}
            <span className="whitespace-nowrap text-center">
              {readingTime} min read
            </span>

            {/* Views */}
            <div className="flex justify-center whitespace-nowrap">
              <PostViewCounter
                slug={supabasePost.slug}
              />
            </div>

            {/* Tag */}
            {tags.length > 0 && (
              <a
                href={`/categories/${generateSlug(tags[0])}`}
                className="
                  hover:underline
                  whitespace-nowrap
                  text-right
                "
              >
                #{tags[0]}
              </a>
            )}

          </div>

          {/* ==================================================
              ARTICLE CONTENT
          =================================================== */}

          <div
            className="
              grid
              grid-cols-12
              gap-y-8
              lg:gap-8
              sxl:gap-16
              mt-8
              px-5
              md:px-10
            "
          >

            {/* Table of Contents */}
            <div className="col-span-12 lg:col-span-4">

              <details
                className="
                  border-[1px]
                  border-solid
                  border-dark
                  dark:border-light
                  text-dark
                  dark:text-light
                  rounded-lg
                  p-4
                  sticky
                  top-6
                  max-h-[80vh]
                  overflow-hidden
                  overflow-y-auto
                "
                open
              >

                <summary
                  className="
                    text-lg
                    font-semibold
                    capitalize
                    cursor-pointer
                  "
                >
                  Table Of Content
                </summary>

                <p className="mt-4 text-sm opacity-60">
                  This post was created through the admin dashboard.
                </p>

              </details>

            </div>

            {/* Post Content */}
            <RenderSupabasePost
              content={content}
            />

            {/* Comments */}
            <Comments
              slug={supabasePost.slug}
            />

          </div>

        </article>
      </>
    );
  }

  /*
   * ============================================================
   * FALL BACK TO VELITE / MDX POST
   * ============================================================
   */

  const blog = blogs.find(
    (blog) => blog.slug === slug
  );

  if (!blog) {
    notFound();
  }

  /*
   * ============================================================
   * VELITE / MDX POST
   * ============================================================
   */

  let imageList = [siteMetadata.socialBanner];

  if (blog.image) {
    imageList =
      typeof blog.image.src === "string"
        ? [siteMetadata.siteUrl + blog.image.src]
        : blog.image;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: blog.title,
    description: blog.description,
    image: imageList,
    datePublished: new Date(
      blog.publishedAt
    ).toISOString(),
    dateModified: new Date(
      blog.updatedAt || blog.publishedAt
    ).toISOString(),
    author: [
      {
        "@type": "Person",
        name: blog.author
          ? blog.author
          : siteMetadata.author,
        url: siteMetadata.twitter,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <article>

        {/* ==================================================
            VELITE HERO
        =================================================== */}

        <div className="mb-8 text-center relative w-full h-[70vh] bg-dark">

          <div
            className="
              w-full
              z-10
              flex
              flex-col
              items-center
              justify-center
              absolute
              top-1/2
              left-1/2
              -translate-x-1/2
              -translate-y-1/2
            "
          >

            {blog.tags?.length > 0 && (
              <Tag
                name={blog.tags[0]}
                link={`/categories/${generateSlug(
                  blog.tags[0]
                )}`}
                className="px-6 text-sm py-2"
              />
            )}

            <h1
              className="
                inline-block
                mt-6
                font-semibold
                capitalize
                text-light
                text-2xl
                md:text-3xl
                lg:text-5xl
                !leading-normal
                relative
                w-5/6
              "
            >
              {blog.title}
            </h1>

          </div>

          <div
            className="
              absolute
              top-0
              left-0
              right-0
              bottom-0
              h-full
              bg-dark/60
              dark:bg-dark/40
              z-10
            "
          />

          <Image
            src={blog.image.src}
            placeholder="blur"
            blurDataURL={blog.image.blurDataURL}
            alt={blog.title}
            width={blog.image.width}
            height={blog.image.height}
            className="
              aspect-square
              w-full
              h-full
              object-cover
              object-center
              z-0
            "
            priority
            sizes="100vw"
          />

        </div>

        {/* ==================================================
            VELITE DETAILS
        =================================================== */}

        <BlogDetails
          blog={blog}
        />

        {/* ==================================================
            VELITE CONTENT
        =================================================== */}

        <div
          className="
            grid
            grid-cols-12
            gap-y-8
            lg:gap-8
            sxl:gap-16
            mt-8
            px-5
            md:px-10
          "
        >

          {/* Table of Contents */}
          <div className="col-span-12 lg:col-span-4">

            <details
              className="
                border-[1px]
                border-solid
                border-dark
                dark:border-light
                text-dark
                dark:text-light
                rounded-lg
                p-4
                sticky
                top-6
                max-h-[80vh]
                overflow-hidden
                overflow-y-auto
              "
              open
            >

              <summary
                className="
                  text-lg
                  font-semibold
                  capitalize
                  cursor-pointer
                "
              >
                Table Of Content
              </summary>

              <ul className="mt-4 font-in text-base">

                {blog.toc?.map((item) => (
                  <TableOfContentsItem
                    key={item.url}
                    item={item}
                  />
                ))}

              </ul>

            </details>

          </div>

          {/* Post Content */}
          <RenderMdx blog={blog} />

          {/* Comments */}
          <Comments
            slug={blog.slug}
          />

        </div>

      </article>
    </>
  );
}