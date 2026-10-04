import FormBuilder from "@/src/components/Admin/FormBuilder";

export const metadata = { title: "Edit form" };

export default async function EditFormPage({ params }) {
  const { id } = await params;
  return <FormBuilder formId={id} />;
}
