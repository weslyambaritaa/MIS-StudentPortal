"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white p-8 shadow-sm sm:p-10" role="alert">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Service interruption</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">We couldn&apos;t load this page</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Something went wrong while loading this part of the portal. Please try again. If the problem continues, contact Developer Support.</p>
        <button className="mt-6 rounded-full bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
