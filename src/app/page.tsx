import Link from "next/link";
import { GraduationCap, Calculator, ArrowRight, Clock3, FileText, Map } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-white">
            <GraduationCap size={16} aria-hidden />
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900">
            Campus<span className="text-indigo-600">+</span>
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Student utilities</p>
        <h1 className="mt-2 text-[clamp(1.8rem,4.6vw,2.8rem)] font-bold leading-tight tracking-tight text-slate-900">
          The kit every student carries.
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
          Campus+ packs precision tools for coursework — starting with a full
          scientific calculator that runs entirely on your device.
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/calculator"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-indigo-600 text-white">
              <Calculator size={22} aria-hidden />
            </span>
            <h2 className="mt-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              Scientific Calculator
              <ArrowRight size={16} className="text-indigo-600 transition group-hover:translate-x-0.5" aria-hidden />
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              SCW-100 ClassWiz-style simulator: exact fractions, trig modes, complex
              numbers, matrices, vectors, equation solving, statistics, Base-N logic,
              distributions and function tables — with a working physical keypad and
              natural textbook display.
            </p>
            <p className="mt-3 text-xs font-semibold text-indigo-700">
              No sign-in needed · runs offline in the browser
            </p>
          </Link>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
              <span className="grid size-9 place-items-center rounded-lg bg-slate-200 text-slate-500">
                <Clock3 size={18} aria-hidden />
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-700">Timetable</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Plan your week, rooms and sections.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
                <span className="grid size-9 place-items-center rounded-lg bg-slate-200 text-slate-500">
                  <FileText size={18} aria-hidden />
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-700">Notes</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Course notes &amp; sharing.</p>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
                <span className="grid size-9 place-items-center rounded-lg bg-slate-200 text-slate-500">
                  <Map size={18} aria-hidden />
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-700">Campus map</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Find rooms &amp; labs.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
