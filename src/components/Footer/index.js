"use client";

import React from "react";
import Link from "next/link";
import NewsletterForm from "./NewsletterForm";

const Footer = () => {
  return (
    <footer className="mt-16 rounded-2xl bg-dark dark:bg-accentDark/90 m-2 sm:m-10 flex flex-col items-center text-light dark:text-dark">

      <h3 className="mt-16 font-medium dark:font-bold text-center capitalize text-2xl sm:text-3xl lg:text-4xl px-4">
        Becoming | Unlearning | Loving
      </h3>

      <p className="mt-5 px-4 text-center w-full sm:w-3/5 font-light dark:font-medium text-sm sm:text-base">
        Thoughtful writing, meaningful resources and important updates.
      </p>

      {/* Newsletter */}
      <NewsletterForm />

      {/* Footer Links */}
      <nav
        aria-label="Footer links"
        className="
          mt-10
          flex
          flex-wrap
          items-center
          justify-center
          gap-x-6
          gap-y-3
          px-6
          text-sm
          font-medium
        "
      >

        {/* Personal Website */}
        <a
          href="https://nimbalkar.in"
          target="_blank"
          rel="noopener noreferrer"
          className="
            opacity-80
            transition-opacity
            hover:opacity-100
            hover:underline
          "
        >
          Portfolio
        </a>

        {/* Disclaimer */}
        <Link
          href="/disclaimer"
          className="
            opacity-80
            transition-opacity
            hover:opacity-100
            hover:underline
          "
        >
          Disclaimer
        </Link>

      </nav>

      {/* Copyright */}
      <div
        className="
          w-full
          mt-10
          md:mt-16
          relative
          font-medium
          border-t
          border-solid
          border-light
          py-6
          px-8
          flex
          flex-col
          md:flex-row
          items-center
          justify-between
        "
      >
        <span className="text-center">
          &copy;2025-26 Vismaya Nimbalkar. All rights reserved.
        </span>
      </div>

    </footer>
  );
};

export default Footer;