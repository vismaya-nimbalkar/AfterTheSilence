"use client";

import { useEffect, useState } from "react";

const DISCLAIMER_STORAGE_KEY = "afterTheSilenceDisclaimerAccepted";

export default function DisclaimerGate({ children }) {
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /*
   * Check whether the disclaimer has already
   * been accepted during this browser session.
   */
  useEffect(() => {
    try {
      const hasAccepted = sessionStorage.getItem(
        DISCLAIMER_STORAGE_KEY
      );

      if (hasAccepted === "true") {
        setAccepted(true);
      }
    } catch (error) {
      console.error(
        "Could not access sessionStorage:",
        error
      );
    }

    setLoaded(true);
  }, []);

  const handleAccept = () => {
    if (!checked) return;

    try {
      sessionStorage.setItem(
        DISCLAIMER_STORAGE_KEY,
        "true"
      );
    } catch (error) {
      console.error(
        "Could not save disclaimer acceptance:",
        error
      );
    }

    setAccepted(true);
  };

  /*
   * Don't render the gate until we've checked
   * sessionStorage.
   *
   * This prevents the disclaimer from flashing
   * briefly during page load for returning visitors.
   */
  if (!loaded) {
    return null;
  }

  /*
   * Disclaimer already accepted during this session.
   */
  if (accepted) {
    return children;
  }

  return (
    <>
      {/* Website remains underneath but cannot be interacted with */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
      >
        {children}
      </div>

      {/* Full-screen disclaimer gate */}
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white p-4 sm:p-6">

        <div className="flex h-full max-h-[900px] w-full max-w-5xl flex-col rounded-2xl border border-black/10 bg-white shadow-2xl">

          {/* Header */}
          <div className="border-b border-black/10 px-6 py-6 sm:px-10">

            <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
              DISCLAIMER
            </h1>

            <p className="mt-3 text-sm font-medium text-gray-500">
              Last updated December 25, 2025
            </p>

          </div>

          {/* Disclaimer content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8">

            <section>

              <h2 className="mb-4 text-xl font-bold tracking-tight text-black sm:text-2xl">
                WEBSITE DISCLAIMER
              </h2>

              <p className="text-sm leading-7 text-gray-600 sm:text-base">
                The information provided by Vismaya Nimbalkar &amp; After The
                Silence (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) on{" "}
                <a
                  href="https://afterthesilence.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  https://afterthesilence.org
                </a>{" "}
                (the &quot;Site&quot;) is for general informational purposes
                only. All information on the Site is provided in good faith,
                however we make no representation or warranty of any kind,
                express or implied, regarding the accuracy, adequacy,
                validity, reliability, availability, or completeness of any
                information on the Site. UNDER NO CIRCUMSTANCES SHALL WE HAVE
                ANY LIABILITY TO YOU FOR ANY LOSS OR DAMAGE OF ANY KIND
                INCURRED AS A RESULT OF THE USE OF THE SITE OR RELIANCE ON ANY
                INFORMATION PROVIDED ON THE SITE. YOUR USE OF THE SITE AND
                YOUR RELIANCE ON ANY INFORMATION ON THE SITE IS SOLELY AT YOUR
                OWN RISK.
              </p>

            </section>

            <section className="mt-10">

              <h2 className="mb-4 text-xl font-bold tracking-tight text-black sm:text-2xl">
                EXTERNAL LINKS DISCLAIMER
              </h2>

              <p className="text-sm leading-7 text-gray-600 sm:text-base">
                The Site may contain (or you may be sent through the Site)
                links to other websites or content belonging to or originating
                from third parties or links to websites and features in
                banners or other advertising. Such external links are not
                investigated, monitored, or checked for accuracy, adequacy,
                validity, reliability, availability, or completeness by us. WE
                DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY
                FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY
                THIRD-PARTY WEBSITES LINKED THROUGH THE SITE OR ANY WEBSITE OR
                FEATURE LINKED IN ANY BANNER OR OTHER ADVERTISING. WE WILL NOT
                BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY
                TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS OF PRODUCTS
                OR SERVICES.
              </p>

            </section>

            <section className="mt-10">

              <h2 className="mb-4 text-xl font-bold tracking-tight text-black sm:text-2xl">
                PROFESSIONAL DISCLAIMER
              </h2>

              <p className="text-sm leading-7 text-gray-600 sm:text-base">
                The Site cannot and does not contain legal, medical advice.
                The legal, medical information is provided for general
                informational and educational purposes only and is not a
                substitute for professional advice. Accordingly, before
                taking any actions based upon such information, we encourage
                you to consult with the appropriate professionals. We do not
                provide any kind of legal, medical advice. THE USE OR RELIANCE
                OF ANY INFORMATION CONTAINED ON THE SITE IS SOLELY AT YOUR OWN
                RISK.
              </p>

            </section>

          </div>

          {/* Consent area */}
          <div className="border-t border-black/10 bg-gray-50 px-6 py-6 sm:px-10">

            <label className="flex cursor-pointer items-start gap-3">

              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  setChecked(e.target.checked)
                }
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-black"
              />

              <span className="text-sm leading-6 text-gray-700">
                I have read and understood this disclaimer and acknowledge
                that I am accessing and using this website at my own risk.
              </span>

            </label>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!checked}
              className="
                mt-5
                w-full
                rounded-xl
                bg-black
                px-6
                py-4
                text-sm
                font-semibold
                text-white
                transition-all
                hover:bg-gray-800
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              I Agree &amp; Continue
            </button>

          </div>

        </div>

      </div>
    </>
  );
}