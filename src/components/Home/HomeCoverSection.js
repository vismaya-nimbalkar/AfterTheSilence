import { sortBlogs } from "@/src/utils";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import Tag from "../Elements/Tag";
import { slug } from "github-slugger";

const HomeCoverSection = ({ blogs }) => {
  const sortedBlogs = sortBlogs(blogs);

  const blog = sortedBlogs[0];

  if (
    !blog ||
    !blog.image ||
    !blog.image.src
  ) {
    return null;
  }

  /*
   * Supabase images are already public URLs,
   * so we use a normal <img>.
   *
   * Old Velite images continue using Next/Image.
   */

  const isSupabaseImage =
    blog.image.src.includes(
      "supabase.co/storage"
    );

  return (
    <div className="w-full inline-block">

      <article
        className="
          flex
          flex-col
          items-start
          justify-end
          mx-5
          sm:mx-10
          relative
          h-[60vh]
          sm:h-[85vh]
          home-image-frame
          rounded-3xl
        "
      >

        {/* Gradient */}

        <div
          className="
            absolute
            top-0
            left-0
            bottom-0
            right-0
            h-full
            bg-gradient-to-b
            from-transparent
            from-0%
            to-dark/90
            rounded-3xl
            z-0
          "
        />

        {/* Cover Image */}

        {isSupabaseImage ? (
          <img
            src={blog.image.src}
            alt={blog.title}
            className="
              absolute
              inset-0
              w-full
              h-full
              object-center
              object-cover
              rounded-3xl
              -z-10
            "
          />
        ) : (
          <Image
            src={blog.image.src}
            placeholder={
              blog.image.blurDataURL
                ? "blur"
                : "empty"
            }
            blurDataURL={
              blog.image.blurDataURL ||
              undefined
            }
            alt={blog.title}
            fill
            className="
              w-full
              h-full
              object-center
              object-cover
              rounded-3xl
              -z-10
            "
            sizes="100vw"
            priority
          />
        )}

        {/* Text */}

        <div
          className="
            w-full
            lg:w-3/4
            p-6
            sm:p-8
            md:p-12
            lg:p-16
            flex
            flex-col
            items-start
            justify-center
            z-0
            text-light
          "
        >

          {/* Tag */}

          {blog.tags?.length > 0 && (
            <Tag
              link={`/categories/${slug(
                blog.tags[0]
              )}`}
              name={blog.tags[0]}
            />
          )}

          {/* Title */}

          <Link
            href={blog.url}
            className="mt-6"
          >
            <h1
              className="
                font-bold
                capitalize
                text-lg
                sm:text-xl
                md:text-3xl
                lg:text-4xl
              "
            >
              <span
                className="
                  bg-gradient-to-r
                  from-accent
                  to-accent
                  dark:from-accentDark/50
                  dark:to-accentDark/50
                  bg-[length:0px_6px]
                  hover:bg-[length:100%_6px]
                  bg-left-bottom
                  bg-no-repeat
                  transition-[background-size]
                  duration-500
                "
              >
                {blog.title}
              </span>
            </h1>
          </Link>

          {/* Description */}

          {blog.description && (
            <p
              className="
                hidden
                sm:inline-block
                mt-4
                md:text-lg
                lg:text-xl
                font-in
              "
            >
              {blog.description}
            </p>
          )}

        </div>

      </article>

    </div>
  );
};

export default HomeCoverSection;