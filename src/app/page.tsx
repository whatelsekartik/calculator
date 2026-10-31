import type { Metadata } from "next";
import CalculatorPageContent from "@/components/calculator/CalculatorPageContent";

export const metadata: Metadata = {
  title: "Scientific Calculator — Campus+",
  description:
    "A Campus+ fx-991ES PLUS-style scientific calculator with natural textbook display and on-device calculations.",
};

export default function HomePage() {
  return <CalculatorPageContent />;
}
