import type { Metadata } from "next";
import CalculatorPageContent from "@/components/calculator/CalculatorPageContent";

export const metadata: Metadata = {
  title: "Scientific Calculator — Campus+",
  description:
    "A Campus+ fx-991ES PLUS-style scientific calculator with natural textbook display, fractions, trigonometry, complex numbers, matrices, vectors, equations, statistics, Base-N, and more. Runs in your browser.",
};

export default function CalculatorPage() {
  return <CalculatorPageContent />;
}
