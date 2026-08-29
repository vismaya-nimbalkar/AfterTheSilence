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
    <header className="w-full p-4 px-5 sm:px-10 flex items-center justify-between">
      <Logo />

      {/* Quick Exit */}
      <button
        type="button"
        onClick={quickExit}
        className="
          fixed
          top-4
          right-4
          z-[100]
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
        className="inline-block sm:hidden z-50"
        onClick={toggle}
        aria-label="Hamburger Menu"
      >
        <div className="w-6 cursor-pointer transition-all ease duration-300">
          <div className="relative">

            <span
              className="
                absolute
                top-0
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
                  ? "rotate(-45deg) translateY(0)"
                  : "rotate(0deg) translateY(6px)",
              }}
            >
              &nbsp;
            </span>

            <span
              className="
                absolute
                top-0
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
                top-0
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
                  ? "rotate(45deg) translateY(0)"
                  : "rotate(0deg) translateY(-6px)",
              }}
            >
              &nbsp;
            </span>

          </div>
        </div>
      </button>

      {/* Mobile Nav */}
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
          right-1/2
          translate-x-1/2
          bg-light/80
          backdrop-blur-sm
          z-50
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

      {/* Desktop Nav */}
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