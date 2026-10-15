import Link from "next/link";

export default function PrivacyNotice({ action = "submitting" }) {
  return (
    <p className="mt-2 text-center text-xs opacity-60">
      By {action}, you agree to our{" "}
      <Link href="/privacy-policy" className="underline underline-offset-2">
        Privacy Policy
      </Link>{" "}
      and{" "}
      <Link href="/terms" className="underline underline-offset-2">
        Terms &amp; Conditions
      </Link>
      .
    </p>
  );
}
