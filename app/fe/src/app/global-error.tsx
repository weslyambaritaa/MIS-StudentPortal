"use client";

import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 font-sans">
          <section className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white p-8 shadow-sm sm:p-10" role="alert">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Service interruption</p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">The portal is temporarily unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Please try again. If the problem continues, contact Developer Support.</p>
            {error.digest && <p className="mt-4 text-xs text-slate-500">Reference: {error.digest}</p>}
            <button className="mt-6 rounded-full bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" onClick={() => reset()}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
