import { blogs as veliteBlogs } from "@/.velite/generated";
import { createClient } from "@/src/lib/supabase/server";
import siteMetadata from "@/src/utils/siteMetaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = siteMetadata.siteUrl.replace(/\/+$/, "");
const feedUrl = `${siteUrl}/feed.xml`;

function escapeXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

function renderItem(blog) {
  const url = new URL(blog.url, siteUrl).toString();
  const pubDate = formatDate(blog.publishedAt);

  return [
    "<item>",
    `<title>${escapeXml(blog.title)}</title>`,
    `<link>${escapeXml(url)}</link>`,
    `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
    blog.description
      ? `<description>${escapeXml(blog.description)}</description>`
      : "",
    pubDate ? `<pubDate>${escapeXml(pubDate)}</pubDate>` : "",
    blog.author
      ? `<dc:creator>${escapeXml(blog.author)}</dc:creator>`
      : "",
    ...(Array.isArray(blog.tags)
      ? blog.tags.map((tag) => `<category>${escapeXml(tag)}</category>`)
      : []),
    "</item>",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: supabasePosts, error } = await supabase
      .from("posts")
      .select("title, slug, description, author, tags, published_at, created_at, is_published")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (error) {
      throw error;
    }

    const publishedSupabasePosts = (supabasePosts || []).map((post) => ({
      ...post,
      url: `/blogs/${post.slug}`,
      publishedAt: post.published_at || post.created_at,
    }));
    const publishedBlogs = [
      ...publishedSupabasePosts,
      ...veliteBlogs.filter((blog) => blog.isPublished !== false),
    ].filter((blog) => blog.title && blog.url);
    const uniqueBlogs = [
      ...new Map(publishedBlogs.map((blog) => [blog.url, blog])).values(),
    ].sort(
      (a, b) =>
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
    );

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
      "<channel>",
      `<title>${escapeXml(siteMetadata.title)}</title>`,
      `<link>${escapeXml(siteUrl)}</link>`,
      `<description>${escapeXml(siteMetadata.description)}</description>`,
      `<language>${escapeXml(siteMetadata.language)}</language>`,
      `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      ...uniqueBlogs.map(renderItem),
      "</channel>",
      "</rss>",
    ].join("\n");

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("RSS feed generation error:", error);
    return new Response("Unable to generate RSS feed.", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }
}
