import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Sigma, ShieldCheck, Keyboard } from "lucide-react";
import ScientificCalculator from "@/components/calculator/CalculatorLoader";

export const metadata: Metadata = {
  title: "Scientific Calculator — Campus+",
  description:
    "A Campus+ fx-991ES PLUS-style scientific calculator with natural textbook display, fractions, trigonometry, complex numbers, matrices, vectors, equations, statistics, Base-N, and more. Runs in your browser."
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
              Natural-V.P.A.M. Scientific Calculator
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A Campus+ recreation of the fx-991ES PLUS 2nd edition&apos;s physical
              arrangement, with textbook fractions and roots, a movable cursor,
              replay history, and eight calculator modes. Calculations stay on-device.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Sigma size={15} className="text-indigo-600" aria-hidden />
              Apps on this unit
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              <li>COMP — exact fractions, trig, calculus</li>
              <li>CMPLX — rectangular / polar arithmetic</li>
              <li>STAT — data and regression tools</li>
              <li>BASE-N — binary, octal, decimal, hex</li>
              <li>EQN — polynomial / simultaneous systems</li>
              <li>MATRIX — dimensions, products, inverse</li>
              <li>TABLE — evaluate functions over ranges</li>
              <li>VECTOR — magnitude, dot, cross products</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Keyboard size={15} className="text-indigo-600" aria-hidden />
              Quick keys
            </h2>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
              <li><b>MODE</b> selects COMP, CMPLX, STAT, BASE-N, EQN, MATRIX, TABLE or VECTOR.</li>
              <li><b>SHIFT + MODE</b> opens setup · <b>ALPHA + letter</b> inserts variables.</li>
              <li>▲▼ replays history · <b>S⇔D</b> toggles fraction ⇔ decimal.</li>
              <li><b>CALC</b> evaluates with current variable values · <b>∫</b> opens an integral template.</li>
              <li>Keyboard: digits/operators, Enter, arrows, Backspace, Esc.</li>
            </ul>
          </div>

          <p className="text-xs leading-5 text-slate-400">
            Independently built by Campus+ as an fx-991ES PLUS-style recreation;
            not affiliated with or endorsed by Casio. Calculations and saved state stay in your browser.
          </p>
        </aside>
      </div>
    </main>
  );
}
