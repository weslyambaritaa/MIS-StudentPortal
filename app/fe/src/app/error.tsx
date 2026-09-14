"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Something went wrong.</h1>
      <button className="mt-4" onClick={() => reset()}>Try again</button>
    </main>
  );
}
