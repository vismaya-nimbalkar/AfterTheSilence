const DEFAULT_ABOUT_TEXT = "This is a blog created for queer people in India to find relevant, accessible information about social, medical, and legal transitioning. It exists as a resource for those trying to navigate complex systems; both socially, legally, and medically. Alongside practical guides, this blog also features writing on social issues affecting the queer community in India, with a focus on lived experiences, systemic barriers, and the realities that are often ignored or oversimplified. Contact me at vismaya@afterthesilence.org or +1 (951) 417-1853. If you would like to apply to be a writer, please apply here.";

export const DEFAULT_ABOUT_BODY = JSON.stringify({
  document: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: DEFAULT_ABOUT_TEXT },
        ],
      },
    ],
  },
  footnotes: [],
});

export const DEFAULT_SITE_SETTINGS = {
  contact_phone: "",
  contact_email: "",
  about_heading: "No Longer Silent",
  about_body: DEFAULT_ABOUT_BODY,
};

export function normalizeAboutBody(value) {
  if (!value) return DEFAULT_ABOUT_BODY;

  try {
    const parsed = JSON.parse(value);
    if (parsed?.document?.type === "doc" || parsed?.type === "doc") {
      return typeof value === "string" ? value : JSON.stringify(value);
    }
  } catch {
    // Convert legacy plain text into the editor's document format.
  }

  return JSON.stringify({
    document: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: String(value) }] }],
    },
    footnotes: [],
  });
}

export async function getSiteSettings(supabase) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("contact_phone, contact_email, about_heading, about_body")
    .eq("id", "global")
    .maybeSingle();

  if (error || !data) return DEFAULT_SITE_SETTINGS;

  return {
    ...DEFAULT_SITE_SETTINGS,
    contact_phone: data.contact_phone ?? DEFAULT_SITE_SETTINGS.contact_phone,
    contact_email: data.contact_email ?? DEFAULT_SITE_SETTINGS.contact_email,
    about_heading: data.about_heading ?? DEFAULT_SITE_SETTINGS.about_heading,
    about_body: normalizeAboutBody(data.about_body),
  };
}