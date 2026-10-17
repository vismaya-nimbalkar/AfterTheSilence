import React from "react";
import Link from "next/link";
import NewsletterForm from "./NewsletterForm";
import { createClient } from "@/src/lib/supabase/server";
import { getSiteSettings } from "@/src/lib/siteSettings";
import { FaGithub, FaLinkedin, FaInstagram, FaReddit, FaDiscord } from "react-icons/fa6";

export const revalidate = 0; // Ensures fresh data load on page refresh

const Footer = async () => {
  const settings = await getSiteSettings(await createClient());

  const socialLinks = [
    { name: "GitHub", url: settings?.github_url, icon: FaGithub },
    { name: "LinkedIn", url: settings?.linkedin_url, icon: FaLinkedin },
    { name: "Instagram", url: settings?.instagram_url, icon: FaInstagram },
    { name: "Reddit", url: settings?.reddit_url, icon: FaReddit },
    { name: "Discord", url: settings?.discord_url, icon: FaDiscord },
  ].filter((link) => Boolean(link.url));

  return (
    <footer className="mt-16 rounded-2xl bg-dark dark:bg-[#fffbea] m-2 sm:m-10 flex flex-col items-center text-light dark:text-dark">
      <h3 className="mt-16 font-medium dark:font-bold text-center capitalize text-2xl sm:text-3xl lg:text-4xl px-4">
        Becoming | Unlearning | Loving
      </h3>

      <p className="mt-5 px-4 text-center w-full sm:w-3/5 font-light dark:font-medium text-sm sm:text-base">
        Thoughtful writing, meaningful resources and important updates.
      </p>

      {/* Newsletter */}
      <NewsletterForm />

      {/* Footer Contact */}
      {(settings?.contact_phone || settings?.contact_email) && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 text-sm font-medium">
          {settings.contact_phone && (
            <a href={`tel:${settings.contact_phone}`} className="opacity-80 transition-opacity hover:opacity-100 hover:underline">
              {settings.contact_phone}
            </a>
          )}
          {settings.contact_email && (
            <a href={`mailto:${settings.contact_email}`} className="opacity-80 transition-opacity hover:opacity-100 hover:underline">
              {settings.contact_email}
            </a>
          )}
        </div>
      )}

      {/* Navigation Links */}
      <nav
        aria-label="Footer links"
        className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 text-sm font-medium"
      >
        <a href="https://nimbalkar.in" target="_blank" rel="noopener noreferrer" className="opacity-80 transition-opacity hover:opacity-100 hover:underline">
          Portfolio
        </a>
        <Link href="/privacy-policy" className="opacity-80 transition-opacity hover:opacity-100 hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="opacity-80 transition-opacity hover:opacity-100 hover:underline">
          Terms &amp; Conditions
        </Link>
        <Link href="/ai-policy" className="opacity-80 transition-opacity hover:opacity-100 hover:underline">
          AI Policy
        </Link>
        <Link href="/disclaimer" className="opacity-80 transition-opacity hover:opacity-100 hover:underline">
          Disclaimer
        </Link>
      </nav>

      {/* Very Bottom: Social Icons + Copyright */}
      <div className="w-full mt-10 relative font-medium border-t border-solid border-light/20 dark:border-dark/20 py-6 px-8 flex flex-col md:flex-row items-center justify-between gap-y-4">
        <div className="flex items-center gap-5">
          {socialLinks.map(({ name, url, icon: Icon }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              className="opacity-80 transition-opacity hover:opacity-100 text-xl"
            >
              <Icon />
            </a>
          ))}
          <a
            href="/feed.xml"
            aria-label="RSS Feed"
            title="RSS Feed"
            className="flex flex-none items-center justify-center opacity-80 transition-opacity hover:opacity-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2.5" y="2.5" width="19" height="19" rx="4" />
              <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
              <path d="M7 12a5 5 0 0 1 5 5" />
              <path d="M7 7a10 10 0 0 1 10 10" />
            </svg>
          </a>
        </div>

        {/* Copyright Text */}
        <span className="text-center text-sm opacity-80">
          &copy;2025-26 Vismaya Nimbalkar. All rights reserved.
        </span>

      </div>
    </footer>
  );
};

export default Footer;