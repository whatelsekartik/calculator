"use client";

import dynamic from "next/dynamic";

const ScientificCalculator = dynamic(
  () => import("./ScientificCalculator").then((m) => m.ScientificCalculator),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto grid w-full max-w-[402px] place-items-center rounded-3xl border border-slate-300 bg-slate-200/70 text-sm font-medium text-slate-500"
        style={{ aspectRatio: "0.62" }}
        aria-label="Loading calculator"
        role="status"
      >
        SCW-100 warming up…
      </div>
    ),
  },
);

export default ScientificCalculator;
