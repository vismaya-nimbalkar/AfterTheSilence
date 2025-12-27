import AboutCoverSection from "@/src/components/About/AboutCoverSection";
import Link from "next/link";

export const metadata = {
  title: "About Us",
  description: `The Heart`,
};

export default function About() {
  return (
    <>
      <AboutCoverSection />
    </>
  );
}
