"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useState, useEffect, useCallback } from "react";

const QUICK_EXIT_URL = "https://www.google.com";
import { MoonIcon, SunIcon } from "../Icons";
import { useThemeSwitch } from "../Hooks/useThemeSwitch";

const Header = () => {
  const [click, setClick] = useState(false);
  const [mode, setMode] = useThemeSwitch();

  const toggle = () => {
    setClick(!click);
  };

  const quickExit = useCallback(() => {
    try {
      sessionStorage.setItem(
        "after-the-silence-quick-exit",
        "true"
      );
    } catch {}

    window.location.replace(QUICK_EXIT_URL);
  }, []);

  useEffect(() => {
    try {
      if (
        sessionStorage.getItem(
          "after-the-silence-quick-exit"
        ) === "true"
      ) {
        window.location.replace(QUICK_EXIT_URL);
        return undefined;
      }
    } catch {}

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
          gap-4
          sm:hidden
        "
      >
        {/* Quick Exit */}

        <span
          aria-hidden="true"
          className="mx-3 h-6 w-px bg-dark/30 dark:bg-[#f5f5f3]/30"
        />

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
              dark:bg-[#f5f5f3]
            dark:text-dark
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
                dark:bg-[#f5f5f3]
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
                dark:bg-[#f5f5f3]
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
                dark:bg-[#f5f5f3]
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
          dark:bg-dark/80
          dark:text-[#f5f5f3]
          backdrop-blur-sm
          z-[90]
          transition-all
          ease
          duration-300
        "
        style={{
          top: click ? "4.75rem" : "-5rem",
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

        {/* Login */}

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
          Login
        </Link>

        <button
          type="button"
          onClick={() =>
            setMode(mode === "dark" ? "light" : "dark")
          }
          className="rounded-full p-1 hover:opacity-70"
          aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {mode === "dark" ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </button>
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
          dark:bg-light
          dark:text-dark
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
          dark:bg-dark/80
          dark:text-[#f5f5f3]
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

        {/* Login */}

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
          Login
        </Link>

        <span
          aria-hidden="true"
          className="mx-3 h-6 w-px bg-dark/30 dark:bg-[#f5f5f3]/30"
        />

        <button
          type="button"
          onClick={() =>
            setMode(mode === "dark" ? "light" : "dark")
          }
          className="rounded-full p-1 hover:opacity-70"
          aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {mode === "dark" ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </button>
      </nav>
    </header>
  );
};

export default Header;