import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Sigma, ShieldCheck, Keyboard } from "lucide-react";
import ScientificCalculator from "@/components/calculator/CalculatorLoader";

export const metadata: Metadata = {
  title: "Scientific Calculator — Campus+",
  description:
    "Campus+ SCW-100: a ClassWiz-inspired scientific calculator — fractions, trig, complex numbers, matrices, vectors, equations, statistics, distributions, Base-N and more. Runs fully in your browser.",
};

export default function CalculatorPage() {
  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      {/* Campus+ top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft size={16} aria-hidden />
            Utilities
          </Link>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap size={16} aria-hidden />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Campus<span className="text-indigo-600">+</span>
            </span>
          </div>
          <span className="hidden text-sm text-slate-400 sm:inline">/</span>
          <span className="hidden text-sm font-semibold text-slate-700 sm:inline">
            Scientific Calculator
          </span>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:flex">
            <ShieldCheck size={13} aria-hidden />
            100% on-device · no sign-in
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 pt-8 lg:grid-cols-[402px_minmax(0,1fr)]">
        <section aria-label="Calculator">
          <ScientificCalculator />
        </section>

        <aside className="space-y-5 lg:pt-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
              Campus+ Utilities
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              SCW-100 Scientific Calculator
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A faithful physical-calculator experience with natural textbook display:
              stacked fractions, radicals and exponents, a movable editing cursor,
              replay history, and twelve working calculation apps.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Sigma size={15} className="text-indigo-600" aria-hidden />
              Apps on this unit
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              <li>Calculate — exact fractions</li>
              <li>Complex — a+bi / r∠θ</li>
              <li>Base-N — HEX/BIN/OCT/DEC</li>
              <li>Matrix — det, inverse, ×</li>
              <li>Vector — dot &amp; cross</li>
              <li>Statistics — regressions</li>
              <li>Distribution — N, Bin, Po</li>
              <li>Table — f(x), g(x) values</li>
              <li>Equation — up to x⁴</li>
              <li>Inequality — intervals</li>
              <li>Ratio — A:B = C:X</li>
              <li>Math Box — dice &amp; coins</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Keyboard size={15} className="text-indigo-600" aria-hidden />
              Quick keys
            </h2>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
              <li><b>HOME</b> app menu · <b>CTLG</b> functions, constants &amp; unit conversions</li>
              <li><b>SHIFT+(</b> stores into a variable (STO) · <b>ALPHA+letter</b> recalls it</li>
              <li>▲▼ replay history · <b>FMT</b> toggles fraction ⇔ decimal</li>
              <li>SHIFT+°′″ converts a result to degrees-minutes-seconds</li>
              <li>Keyboard: digits, operators, Enter=EXE, Backspace, Esc=AC</li>
            </ul>
          </div>

          <p className="text-xs leading-5 text-slate-400">
            Independently built by Campus+. Inspired by ClassWiz-series devices;
            not affiliated with or endorsed by Casio. All state stays in your browser.
          </p>
        </aside>
      </div>
    </main>
  );
}
