"use client";

import { useEffect, useRef, useState } from "react";

// Map modern ISO/BCP-47 codes to legacy Google Translate Element codes
const LEGACY_CODE_MAP = {
  he: "iw",   // Hebrew
  id: "in",   // Indonesian
  jw: "jv",   // Javanese
  yi: "ji",   // Yiddish
  gom: "kok", // Konkani
};

// Reverse map to restore active state properly on page reload
const REVERSE_LEGACY_MAP = Object.fromEntries(
  Object.entries(LEGACY_CODE_MAP).map(([k, v]) => [v, k])
);

const LANGUAGE_GROUPS = [
  {
    label: "Indian languages",
    languages: [
      ["as", "Assamese", "অসমীয়া"],
      ["bn", "Bengali", "বাংলা"],
      ["gu", "Gujarati", "ગુજરાતી"],
      ["hi", "Hindi", "हिन्दी"],
      ["kn", "Kannada", "ಕನ್ನಡ"],
      ["ks", "Kashmiri", "کٲشُر"],
      ["gom", "Konkani", "कोंकणी"],
      ["ml", "Malayalam", "മലയാളം"],
      ["mni", "Manipuri", "ꯇꯩ ꯂꯣꯟ"],
      ["mr", "Marathi", "मराठी"],
      ["ne", "Nepali", "नेपाली"],
      ["or", "Odia", "ଓଡ଼ିଆ"],
      ["pa", "Punjabi", "ਪੰਜਾਬੀ"],
      ["sa", "Sanskrit", "संस्कृतम्"],
      ["sd", "Sindhi", "سنڌي"],
      ["ta", "Tamil", "தமிழ்"],
      ["te", "Telugu", "తెలుగు"],
      ["ur", "Urdu", "اردو"],
    ],
  },
  {
    label: "Foreign languages",
    languages: [
      ["af", "Afrikaans", "Afrikaans"],
      ["sq", "Albanian", "Shqip"],
      ["am", "Amharic", "አማርኛ"],
      ["ar", "Arabic", "العربية"],
      ["hy", "Armenian", "Հայերեն"],
      ["az", "Azerbaijani", "Azərbaycan dili"],
      ["eu", "Basque", "Euskara"],
      ["be", "Belarusian", "Беларуская"],
      ["bs", "Bosnian", "Bosanski"],
      ["bg", "Bulgarian", "Български"],
      ["ca", "Catalan", "Català"],
      ["ceb", "Cebuano", "Cebuano"],
      ["zh-CN", "Chinese (Simplified)", "简体中文"],
      ["zh-TW", "Chinese (Traditional)", "繁體中文"],
      ["co", "Corsican", "Corsu"],
      ["hr", "Croatian", "Hrvatski"],
      ["cs", "Czech", "Čeština"],
      ["da", "Danish", "Dansk"],
      ["nl", "Dutch", "Nederlands"],
      ["en", "English", "English"],
      ["eo", "Esperanto", "Esperanto"],
      ["et", "Estonian", "Eesti"],
      ["tl", "Filipino", "Filipino"],
      ["fi", "Finnish", "Suomi"],
      ["fr", "French", "Français"],
      ["fy", "Frisian", "Frysk"],
      ["gl", "Galician", "Galego"],
      ["ka", "Georgian", "ქართული"],
      ["de", "German", "Deutsch"],
      ["el", "Greek", "Ελληνικά"],
      ["ht", "Haitian Creole", "Kreyòl ayisyen"],
      ["ha", "Hausa", "Hausa"],
      ["haw", "Hawaiian", "ʻŌlelo Hawaiʻi"],
      ["he", "Hebrew", "עברית"],
      ["hmn", "Hmong", "Hmoob"],
      ["hu", "Hungarian", "Magyar"],
      ["is", "Icelandic", "Íslenska"],
      ["ig", "Igbo", "Igbo"],
      ["id", "Indonesian", "Bahasa Indonesia"],
      ["ga", "Irish", "Gaeilge"],
      ["it", "Italian", "Italiano"],
      ["ja", "Japanese", "日本語"],
      ["jw", "Javanese", "Jawa"],
      ["kk", "Kazakh", "Қазақша"],
      ["km", "Khmer", "ខ្មែរ"],
      ["ko", "Korean", "한국어"],
      ["ku", "Kurdish", "Kurdî"],
      ["ky", "Kyrgyz", "Кыргызча"],
      ["lo", "Lao", "ລາວ"],
      ["la", "Latin", "Latina"],
      ["lv", "Latvian", "Latviešu"],
      ["lt", "Lithuanian", "Lietuvių"],
      ["lb", "Luxembourgish", "Lëtzebuergesch"],
      ["mk", "Macedonian", "Македонски"],
      ["mg", "Malagasy", "Malagasy"],
      ["ms", "Malay", "Bahasa Melayu"],
      ["mt", "Maltese", "Malti"],
      ["mi", "Maori", "Māori"],
      ["mn", "Mongolian", "Монгол"],
      ["my", "Myanmar", "မြန်မာ"],
      ["no", "Norwegian", "Norsk"],
      ["ny", "Nyanja", "Chichewa"],
      ["ps", "Pashto", "پښتو"],
      ["fa", "Persian", "فارسی"],
      ["pl", "Polish", "Polski"],
      ["pt", "Portuguese", "Português"],
      ["ro", "Romanian", "Română"],
      ["ru", "Russian", "Русский"],
      ["sm", "Samoan", "Samoan"],
      ["gd", "Scots Gaelic", "Gàidhlig"],
      ["sr", "Serbian", "Српски"],
      ["st", "Sesotho", "Sesotho"],
      ["sn", "Shona", "Shona"],
      ["si", "Sinhala", "සිංহල"],
      ["sk", "Slovak", "Slovenčina"],
      ["sl", "Slovenian", "Slovenščina"],
      ["so", "Somali", "Soomaali"],
      ["es", "Spanish", "Español"],
      ["su", "Sundanese", "Basa Sunda"],
      ["sw", "Swahili", "Kiswahili"],
      ["sv", "Swedish", "Svenska"],
      ["tg", "Tajik", "Тоҷикӣ"],
      ["th", "Thai", "ไทย"],
      ["tr", "Turkish", "Türkçe"],
      ["tk", "Turkmen", "Türkmençe"],
      ["uk", "Ukrainian", "Українська"],
      ["uz", "Uzbek", "Oʻzbekcha"],
      ["vi", "Vietnamese", "Tiếng Việt"],
      ["cy", "Welsh", "Cymraeg"],
      ["xh", "Xhosa", "isiXhosa"],
      ["yi", "Yiddish", "ייִדיש"],
      ["yo", "Yoruba", "Yorùbá"],
      ["zu", "Zulu", "isiZulu"],
    ],
  },
];

const LANGUAGES = LANGUAGE_GROUPS.flatMap((group) => group.languages);

const getSavedLanguage = () => {
  if (typeof document === "undefined") return "en";

  const match = document.cookie.match(
    /(?:^|; )googtrans=\/en\/([^;]+)/
  );

  if (!match) return "en";

  const rawCode = decodeURIComponent(match[1]);
  return REVERSE_LEGACY_MAP[rawCode] || rawCode;
};

export default function LanguageSelector({
  id = "site-language",
  showTranslateTarget = false,
}) {
  const [language, setLanguage] = useState("en");
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setLanguage(getSavedLanguage());

    const resetTranslationOffset = () => {
      document.body.style.top = "0px";
      document.documentElement.style.top = "0px";
    };

    const bannerStyle = document.createElement("style");

    bannerStyle.textContent = `
      iframe.goog-te-banner-frame,
      .goog-te-banner-frame,
      body > .skiptranslate {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
      }

      html body {
        top: 0 !important;
      }
    `;

    document.head.appendChild(bannerStyle);

    const bannerObserver = new MutationObserver(resetTranslationOffset);

    bannerObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    resetTranslationOffset();

    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);

    if (!showTranslateTarget) {
      return () => {
        bannerObserver.disconnect();
        bannerStyle.remove();
        document.removeEventListener("mousedown", closeMenu);
      };
    }

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) return;

      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: LANGUAGES.map(
            ([code]) => LEGACY_CODE_MAP[code] || code
          ).join(","),
          autoDisplay: false,
        },
        "google_translate_element"
      );
    };

    if (
      !document.querySelector(
        'script[src*="translate.google.com/translate_a/element.js"]'
      )
    ) {
      const script = document.createElement("script");

      script.src =
        "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";

      script.async = true;
      document.body.appendChild(script);
    } else if (window.google?.translate?.TranslateElement) {
      window.googleTranslateElementInit();
    }

    return () => {
      bannerObserver.disconnect();
      bannerStyle.remove();
      document.removeEventListener("mousedown", closeMenu);
      delete window.googleTranslateElementInit;
    };
  }, [showTranslateTarget]);

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    setOpen(false);

    const targetCode = LEGACY_CODE_MAP[nextLanguage] || nextLanguage;

    if (nextLanguage === "en") {
      document.cookie =
        "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";

      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
    } else {
      document.cookie = `googtrans=/en/${targetCode}; path=/; max-age=31536000`;

      document.cookie = `googtrans=/en/${targetCode}; path=/; domain=${window.location.hostname}; max-age=31536000`;
    }

    window.location.reload();
  };

  const selectedLanguage =
    LANGUAGES.find(([code]) => code === language) || LANGUAGES[0];

  return (
    <div className="notranslate" translate="no">
      <div ref={menuRef} className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="rounded-full bg-transparent px-2 py-1 font-medium leading-normal transition-opacity hover:bg-dark/10 hover:opacity-70 dark:hover:bg-light/10"
        >
          {selectedLanguage[1] === selectedLanguage[2]
            ? selectedLanguage[1]
            : `${selectedLanguage[1]} / ${selectedLanguage[2]}`}

          <span className="ml-2 text-xs" aria-hidden="true">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Choose language"
            className="absolute right-0 top-full z-[110] mt-2 max-h-80 w-64 overflow-y-auto rounded-2xl border border-dark/20 bg-light p-2 text-left shadow-xl dark:bg-dark"
          >
            {LANGUAGE_GROUPS.map((group, index) => (
              <div
                key={group.label}
                className={index === 0 ? "pt-2 pb-1" : "pt-5 pb-1"}
              >
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-dark/60 dark:text-light/60">
                  {group.label}
                </p>

                <div className="mx-3 mb-2 border-b border-dark/10 dark:border-light/10" />

                {group.languages.map(([code, label, nativeLabel]) => (
                  <button
                    key={code}
                    type="button"
                    role="menuitem"
                    onClick={() => changeLanguage(code)}
                    className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-dark/10 dark:hover:bg-light/10 ${
                      code === language
                        ? "font-semibold bg-dark/5 dark:bg-light/5 text-accent dark:text-accentDark"
                        : "text-dark/80 dark:text-light/80"
                    }`}
                  >
                    <span className="font-medium">{label}</span>

                    {code !== "en" && (
                      <span className="ml-2 text-xs font-normal opacity-60">
                        {nativeLabel}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {showTranslateTarget && (
        <div id="google_translate_element" aria-hidden="true" />
      )}
    </div>
  );f
}