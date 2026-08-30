"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useState, useEffect, useCallback } from "react";

const QUICK_EXIT_URL = "https://www.google.com";

const Header = () => {
  const [click, setClick] = useState(false);

  const toggle = () => {
    setClick(!click);
  };

  const quickExit = useCallback(() => {
    window.location.replace(QUICK_EXIT_URL);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        quickExit();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [quickExit]);

  return (
    <header
      className="
        relative
        w-full
        p-4
        px-5
        sm:px-10
        flex
        items-center
        justify-between
      "
    >
      <Logo />

      {/* =====================================================
          MOBILE CONTROLS
      ====================================================== */}

      <div
        className="
          ml-auto
          flex
          items-center
          gap-2
          sm:hidden
        "
      >
        {/* Quick Exit */}

        <button
          type="button"
          onClick={quickExit}
          className="
            relative
            z-[100]
            whitespace-nowrap
            px-4
            py-2
            bg-dark
            text-light
            rounded-full
            text-sm
            font-medium
            hover:opacity-80
            transition-opacity
          "
          aria-label="Quick Exit"
        >
          Quick Exit
        </button>

        {/* Hamburger Button */}

        <button
          type="button"
          className="
            relative
            z-[100]
            inline-flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
          "
          onClick={toggle}
          aria-label="Hamburger Menu"
          aria-expanded={click}
        >
          <div
            className="
              relative
              h-6
              w-6
              cursor-pointer
            "
          >
            <span
              className="
                absolute
                left-0
                top-1/2
                inline-block
                w-full
                h-0.5
                bg-dark
                dark:bg-light
                rounded
                transition-all
                ease
                duration-200
              "
              style={{
                transform: click
                  ? "rotate(-45deg)"
                  : "translateY(-6px)",
              }}
            >
              &nbsp;
            </span>

            <span
              className="
                absolute
                left-0
                top-1/2
                inline-block
                w-full
                h-0.5
                bg-dark
                dark:bg-light
                rounded
                transition-all
                ease
                duration-200
              "
              style={{
                opacity: click ? 0 : 1,
              }}
            >
              &nbsp;
            </span>

            <span
              className="
                absolute
                left-0
                top-1/2
                inline-block
                w-full
                h-0.5
                bg-dark
                dark:bg-light
                rounded
                transition-all
                ease
                duration-200
              "
              style={{
                transform: click
                  ? "rotate(45deg)"
                  : "translateY(6px)",
              }}
            >
              &nbsp;
            </span>
          </div>
        </button>
      </div>

      {/* =====================================================
          MOBILE NAV
      ====================================================== */}

      <nav
        className="
          w-max
          py-3
          px-6
          sm:px-8
          border
          border-solid
          border-dark
          rounded-full
          font-medium
          capitalize
          items-center
          flex
          sm:hidden
          fixed
          left-1/2
          -translate-x-1/2
          bg-light/80
          backdrop-blur-sm
          z-[90]
          transition-all
          ease
          duration-300
        "
        style={{
          top: click ? "1rem" : "-5rem",
        }}
      >
        <Link
          href="/"
          className="mr-2"
          onClick={() => setClick(false)}
        >
          Home
        </Link>

        <Link
          href="/about"
          className="mx-2"
          onClick={() => setClick(false)}
        >
          About
        </Link>

        {/* Admin */}

        <Link
          href="/admin/login"
          className="
            ml-4
            pl-4
            border-l
            border-dark/30
            hover:underline
          "
          onClick={() => setClick(false)}
        >
          Admin
        </Link>
      </nav>

      {/* =====================================================
          DESKTOP QUICK EXIT
      ====================================================== */}

      <button
        type="button"
        onClick={quickExit}
        className="
          fixed
          top-4
          right-4
          z-[100]
          hidden
          sm:block
          px-4
          py-2
          bg-dark
          text-light
          rounded-full
          text-sm
          font-medium
          hover:opacity-80
          transition-opacity
        "
        aria-label="Quick Exit"
      >
        Quick Exit
      </button>

      {/* =====================================================
          DESKTOP NAV
      ====================================================== */}

      <nav
        className="
          w-max
          py-3
          px-8
          border
          border-solid
          border-dark
          rounded-full
          font-medium
          capitalize
          items-center
          hidden
          sm:flex
          fixed
          top-6
          right-1/2
          translate-x-1/2
          bg-light/80
          backdrop-blur-sm
          z-50
        "
      >
        <Link
          href="/"
          className="mr-2 hover:underline"
        >
          Home
        </Link>

        <Link
          href="/about"
          className="mx-2 hover:underline"
        >
          About
        </Link>

        {/* Admin */}

        <Link
          href="/admin/login"
          className="
            ml-4
            pl-4
            border-l
            border-dark/30
            hover:underline
          "
        >
          Admin
        </Link>
      </nav>
    </header>
  );
};

export default Header;