export default function DisclaimerPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10 sm:py-24">
      
      <h1 className="text-4xl font-bold tracking-tight text-black dark:text-[#f5f5f3] sm:text-5xl">
        DISCLAIMER
      </h1>

      <p className="mt-4 text-sm font-medium text-gray-500 dark:text-[#f5f5f3]/60">
        Last updated December 25, 2025
      </p>

      <div className="mt-16 space-y-12 text-gray-600 dark:text-[#f5f5f3]/80">

        {/* WEBSITE DISCLAIMER */}
        <section>
          <h2 className="mb-5 text-2xl font-bold text-black dark:text-[#f5f5f3]">
            WEBSITE DISCLAIMER
          </h2>

          <p className="text-base leading-8">
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
            (the &quot;Site&quot;) is for general informational purposes only.
            All information on the Site is provided in good faith, however we
            make no representation or warranty of any kind, express or implied,
            regarding the accuracy, adequacy, validity, reliability,
            availability, or completeness of any information on the Site.
            UNDER NO CIRCUMSTANCES SHALL WE HAVE ANY LIABILITY TO YOU FOR ANY
            LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF THE
            SITE OR RELIANCE ON ANY INFORMATION PROVIDED ON THE SITE. YOUR USE
            OF THE SITE AND YOUR RELIANCE ON ANY INFORMATION ON THE SITE IS
            SOLELY AT YOUR OWN RISK.
          </p>
        </section>

        {/* EXTERNAL LINKS DISCLAIMER */}
        <section>
          <h2 className="mb-5 text-2xl font-bold text-black dark:text-[#f5f5f3]">
            EXTERNAL LINKS DISCLAIMER
          </h2>

          <p className="text-base leading-8">
            The Site may contain (or you may be sent through the Site) links to
            other websites or content belonging to or originating from third
            parties or links to websites and features in banners or other
            advertising. Such external links are not investigated, monitored,
            or checked for accuracy, adequacy, validity, reliability,
            availability, or completeness by us. WE DO NOT WARRANT, ENDORSE,
            GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY
            OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES LINKED THROUGH
            THE SITE OR ANY WEBSITE OR FEATURE LINKED IN ANY BANNER OR OTHER
            ADVERTISING. WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE
            FOR MONITORING ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY
            PROVIDERS OF PRODUCTS OR SERVICES.
          </p>
        </section>

        {/* PROFESSIONAL DISCLAIMER */}
        <section>
          <h2 className="mb-5 text-2xl font-bold text-black dark:text-[#f5f5f3]">
            PROFESSIONAL DISCLAIMER
          </h2>

          <p className="text-base leading-8">
            The Site cannot and does not contain legal, medical advice. The
            legal, medical information is provided for general informational
            and educational purposes only and is not a substitute for
            professional advice. Accordingly, before taking any actions based
            upon such information, we encourage you to consult with the
            appropriate professionals. We do not provide any kind of legal,
            medical advice. THE USE OR RELIANCE OF ANY INFORMATION CONTAINED ON
            THE SITE IS SOLELY AT YOUR OWN RISK.
          </p>
        </section>

      </div>
    </main>
  );
}