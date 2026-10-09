import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const blogsDirectory = path.join(root, "content", "blogs");
const archiveDirectory = path.join(root, "content", "legacy-blogs");

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter.");

  const values = {};
  let activeList = null;

  for (const line of match[1].split("\n")) {
    const listItem = line.match(/^\s*-\s*(.*)$/);
    if (listItem && activeList) {
      values[activeList].push(stripQuotes(listItem[1].trim()));
      continue;
    }

    const field = line.match(/^([A-Za-z][\w]*)\s*:\s*(.*)$/);
    if (!field) continue;

    const [, key, rawValue] = field;
    if (!rawValue.trim()) {
      values[key] = [];
      activeList = key;
    } else {
      values[key] = stripQuotes(rawValue.trim());
      activeList = null;
    }
  }

  return { metadata: values, body: match[2].trim() };
}

function stripQuotes(value) {
  return value.replace(/^("|')(.*)\1$/, "$2");
}

function normalizePublishedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Missing publishedAt.");

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const date = new Date(withTimezone);

  if (Number.isNaN(date.getTime())) throw new Error(`Invalid publishedAt: ${raw}`);
  return date.toISOString();
}

function dateOnly(value) {
  const raw = String(value || "").trim();
  return raw ? raw.slice(0, 10) : null;
}

function parseInline(value) {
  const content = [];
  let remaining = value;

  while (remaining) {
    const match = remaining.match(/^(\*\*|__|\*|_|~~|`|\[)([\s\S]*?)(?:\1|\])/);
    if (!match) {
      content.push({ type: "text", text: remaining });
      break;
    }

    const before = remaining.slice(0, match.index);
    if (before) content.push({ type: "text", text: before });

    const marker = match[1];
    const inner = match[2];
    if (marker === "[") {
      const urlMatch = remaining.slice(match[0].length).match(/^\(([^)]+)\)/);
      if (!urlMatch) {
        content.push({ type: "text", text: match[0] });
        remaining = remaining.slice(match[0].length);
        continue;
      }
      content.push({ type: "text", text: inner, marks: [{ type: "link", attrs: { href: urlMatch[1] } }] });
      remaining = remaining.slice(match.index + match[0].length + urlMatch[0].length);
      continue;
    }

    const markType = marker === "**" || marker === "__"
      ? "bold"
      : marker === "~~"
        ? "strike"
        : marker === "`"
          ? "code"
          : "italic";
    content.push({ type: "text", text: inner, marks: [{ type: markType }] });
    remaining = remaining.slice(match.index + match[0].length);
  }

  return content;
}

function markdownToDoc(markdown) {
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ").trim()) });
    paragraph = [];
  };

  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", attrs: { level: Math.min(heading[1].length, 3) }, content: parseInline(heading[2]) });
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      blocks.push({ type: "image", attrs: { src: image[2], alt: image[1] || "Blog image" } });
      continue;
    }

    const quote = line.match(/^>\s+(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(quote[1]) }] });
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? "bulletList" : "orderedList";
      if (!list || list.type !== type) {
        flushList();
        list = { type, content: [] };
      }
      list.content.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline((unordered || ordered)[1]) }] });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

function toImageUrl(image, assetNames) {
  if (!image) return null;
  if (/^(https?:)?\//.test(image)) return image;
  const assetName = assetNames.find((name) => {
    const imageBase = path.basename(image, path.extname(image)).toLowerCase();
    const assetBase = path.basename(name, path.extname(name)).toLowerCase();
    return assetBase === imageBase || assetBase.startsWith(`${imageBase}-`);
  });
  return `/blogs/${assetName || image}`;
}

async function getLegacyPosts() {
  const hasMdxFiles = async (directory) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory())) {
      try {
        await fs.access(path.join(directory, entry.name, "index.mdx"));
        return true;
      } catch {}
    }
    return false;
  };

  const sourceDirectory = await hasMdxFiles(blogsDirectory) ? blogsDirectory : archiveDirectory;
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
  const assetNames = await fs.readdir(path.join(root, "public", "blogs"));
  const posts = [];

  for (const entry of entries.filter((item) => item.isDirectory())) {
    const filePath = path.join(sourceDirectory, entry.name, "index.mdx");
    const source = await fs.readFile(filePath, "utf8");
    const { metadata, body } = parseFrontmatter(source);
    const publishedAt = normalizePublishedAt(metadata.publishedAt);

    posts.push({
      sourcePath: filePath,
      archivePath: path.join(archiveDirectory, entry.name, "index.mdx"),
      title: metadata.title,
      slug: metadata.slug,
      description: metadata.description || "",
      content: JSON.stringify(markdownToDoc(body)),
      author: metadata.author || "",
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      image_url: toImageUrl(metadata.image, assetNames),
      is_published: metadata.isPublished !== "false",
      published_at: publishedAt,
      last_edited_at: dateOnly(metadata.updatedAt || metadata.publishedAt),
      updated_at: normalizePublishedAt(metadata.updatedAt || metadata.publishedAt),
    });
  }

  return posts;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment variables are required.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const posts = await getLegacyPosts();
  await fs.mkdir(archiveDirectory, { recursive: true });

  for (const post of posts) {
    const { sourcePath, archivePath, ...postData } = post;
    const { data: existing, error: lookupError } = await supabase
      .from("posts")
      .select("id")
      .eq("slug", post.slug)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const { data: saved, error } = existing
      ? await supabase.from("posts").update(postData).eq("id", existing.id).select("id").single()
      : await supabase.from("posts").insert(postData).select("id").single();
    if (error) throw error;

    if (sourcePath !== archivePath) {
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      await fs.rename(sourcePath, archivePath);
    }
    console.log(`${existing ? "Updated" : "Migrated"} ${post.slug} (${saved.id}) published ${post.published_at}`);
  }

  console.log(`Finished migrating ${posts.length} MDX posts. Sources archived in content/legacy-blogs/.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});