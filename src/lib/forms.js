export const FORM_QUESTION_TYPES = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Paragraph" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
];

export const defaultQuestion = (position = 0) => ({
  id: `new-${Date.now()}-${position}`,
  type: "short_text",
  title: "",
  description: "",
  required: false,
  options: [""],
  validation: { allowOther: false },
  position,
});

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/g, "")
    .slice(0, 80);
}

export function normalizeQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map((question, index) => ({
    type: FORM_QUESTION_TYPES.some((item) => item.value === question.type) ? question.type : "short_text",
    title: String(question.title || "").trim().slice(0, 300),
    description: String(question.description || "").trim().slice(0, 1000),
    required: Boolean(question.required),
    options: ["multiple_choice", "checkboxes", "dropdown"].includes(question.type)
      ? (Array.isArray(question.options) ? question.options : []).map((option) => String(option || "").trim()).filter(Boolean).slice(0, 100)
      : [],
    validation: {
      allowOther: Boolean(question.validation?.allowOther),
    },
    image_url: String(question.image_url || "").trim(),
    position: index,
  }));
}

export function isAnswerEmpty(value) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
