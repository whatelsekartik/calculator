/**
 * Scientific constants (CODATA 2018/2022; exact where the SI defines them)
 * and metric/imperial unit conversions with explicit SI factors.
 */

export interface ConstantEntry {
  id: string;
  category: string;
  name: string;
  symbol: string;
  value: number;
  unit: string;
  note?: string;
}

export const CONSTANT_CATEGORIES = ["Universal", "Electromagnetic", "Atomic & Nuclear", "Physico-Chemical"] as const;

export const CONSTANTS: ConstantEntry[] = [
  // Universal
  { id: "c", category: "Universal", name: "Speed of light in vacuum", symbol: "c", value: 299792458, unit: "m/s", note: "exact (SI)" },
  { id: "G", category: "Universal", name: "Gravitational constant", symbol: "G", value: 6.6743e-11, unit: "m³/(kg·s²)", note: "CODATA 2018" },
  { id: "g", category: "Universal", name: "Standard gravity", symbol: "gₙ", value: 9.80665, unit: "m/s²", note: "exact (ISO)" },
  { id: "h", category: "Universal", name: "Planck constant", symbol: "h", value: 6.62607015e-34, unit: "J·s", note: "exact (SI)" },
  { id: "hbar", category: "Universal", name: "Reduced Planck constant", symbol: "ħ", value: 1.054571817e-34, unit: "J·s", note: "h/2π derived" },
  { id: "au", category: "Universal", name: "Astronomical unit", symbol: "au", value: 149597870700, unit: "m", note: "exact (IAU)" },
  // Electromagnetic
  { id: "e-", category: "Electromagnetic", name: "Elementary charge", symbol: "e", value: 1.602176634e-19, unit: "C", note: "exact (SI)" },
  { id: "eps0", category: "Electromagnetic", name: "Vacuum permittivity", symbol: "ε₀", value: 8.8541878128e-12, unit: "F/m", note: "CODATA 2018" },
  { id: "mu0", category: "Electromagnetic", name: "Vacuum permeability", symbol: "μ₀", value: 1.25663706212e-6, unit: "N/A²", note: "CODATA 2018" },
  // Atomic & Nuclear
  { id: "me", category: "Atomic & Nuclear", name: "Electron mass", symbol: "mₑ", value: 9.1093837139e-31, unit: "kg", note: "CODATA 2022" },
  { id: "mp", category: "Atomic & Nuclear", name: "Proton mass", symbol: "mₚ", value: 1.67262192595e-27, unit: "kg", note: "CODATA 2022" },
  { id: "mn", category: "Atomic & Nuclear", name: "Neutron mass", symbol: "mₙ", value: 1.67492750056e-27, unit: "kg", note: "CODATA 2018" },
  { id: "u", category: "Atomic & Nuclear", name: "Atomic mass constant", symbol: "u", value: 1.66053906892e-27, unit: "kg", note: "CODATA 2022" },
  { id: "a0", category: "Atomic & Nuclear", name: "Bohr radius", symbol: "a₀", value: 5.29177210544e-11, unit: "m", note: "CODATA 2022" },
  { id: "rinf", category: "Atomic & Nuclear", name: "Rydberg constant", symbol: "R∞", value: 10973731.568157, unit: "1/m", note: "CODATA 2022" },
  { id: "alpha", category: "Atomic & Nuclear", name: "Fine-structure constant", symbol: "α", value: 7.2973525643e-3, unit: "—", note: "CODATA 2018" },
  // Physico-Chemical
  { id: "NA", category: "Physico-Chemical", name: "Avogadro constant", symbol: "Nₐ", value: 6.02214076e23, unit: "1/mol", note: "exact (SI)" },
  { id: "k", category: "Physico-Chemical", name: "Boltzmann constant", symbol: "k", value: 1.380649e-23, unit: "J/K", note: "exact (SI)" },
  { id: "R", category: "Physico-Chemical", name: "Molar gas constant", symbol: "R", value: 8.31446261815324, unit: "J/(mol·K)", note: "exact (SI)" },
  { id: "F", category: "Physico-Chemical", name: "Faraday constant", symbol: "F", value: 96485.33212, unit: "C/mol", note: "Nₐ·e" },
  { id: "atm", category: "Physico-Chemical", name: "Standard atmosphere", symbol: "atm", value: 101325, unit: "Pa", note: "exact" },
  { id: "sb", category: "Physico-Chemical", name: "Stefan–Boltzmann constant", symbol: "σ", value: 5.670374419e-8, unit: "W/(m²·K⁴)", note: "derived" },
  { id: "wien", category: "Physico-Chemical", name: "Wien displacement constant", symbol: "b", value: 2.897771955e-3, unit: "m·K", note: "CODATA 2018" },
  { id: "ev", category: "Physico-Chemical", name: "Electron volt", symbol: "eV", value: 1.602176634e-19, unit: "J", note: "exact (SI)" },
];

/* ------------------------------------------------------------------ */
/* Unit conversions (factors to SI base unit)                          */
/* ------------------------------------------------------------------ */

export interface UnitDef {
  id: string;
  name: string;
  toSI: number; // multiplier into the base SI unit
  kind?: "temp"; // temperature is affine, handled specially
}

export interface ConvCategory {
  id: string;
  name: string;
  units: UnitDef[];
}

export const CONVERSIONS: ConvCategory[] = [
  {
    id: "length", name: "Length",
    units: [
      { id: "mm", name: "Millimetre (mm)", toSI: 1e-3 },
      { id: "cm", name: "Centimetre (cm)", toSI: 1e-2 },
      { id: "m", name: "Metre (m)", toSI: 1 },
      { id: "km", name: "Kilometre (km)", toSI: 1000 },
      { id: "in", name: "Inch (in)", toSI: 0.0254 },
      { id: "ft", name: "Foot (ft)", toSI: 0.3048 },
      { id: "yd", name: "Yard (yd)", toSI: 0.9144 },
      { id: "mi", name: "Mile (mi)", toSI: 1609.344 },
      { id: "nmi", name: "Nautical mile (nmi)", toSI: 1852 },
    ],
  },
  {
    id: "mass", name: "Mass",
    units: [
      { id: "mg", name: "Milligram (mg)", toSI: 1e-6 },
      { id: "g", name: "Gram (g)", toSI: 1e-3 },
      { id: "kg", name: "Kilogram (kg)", toSI: 1 },
      { id: "t", name: "Tonne (t)", toSI: 1000 },
      { id: "oz", name: "Ounce (oz)", toSI: 0.028349523125 },
      { id: "lb", name: "Pound (lb)", toSI: 0.45359237 },
    ],
  },
  {
    id: "temp", name: "Temperature",
    units: [
      { id: "c", name: "Celsius (°C)", toSI: 1, kind: "temp" },
      { id: "f", name: "Fahrenheit (°F)", toSI: 1, kind: "temp" },
      { id: "k", name: "Kelvin (K)", toSI: 1, kind: "temp" },
    ],
  },
  {
    id: "area", name: "Area",
    units: [
      { id: "cm2", name: "Square centimetre (cm²)", toSI: 1e-4 },
      { id: "m2", name: "Square metre (m²)", toSI: 1 },
      { id: "ha", name: "Hectare (ha)", toSI: 1e4 },
      { id: "km2", name: "Square kilometre (km²)", toSI: 1e6 },
      { id: "ft2", name: "Square foot (ft²)", toSI: 0.09290304 },
      { id: "acre", name: "Acre", toSI: 4046.8564224 },
    ],
  },
  {
    id: "volume", name: "Volume",
    units: [
      { id: "ml", name: "Millilitre (mL)", toSI: 1e-6 },
      { id: "l", name: "Litre (L)", toSI: 1e-3 },
      { id: "m3", name: "Cubic metre (m³)", toSI: 1 },
      { id: "floz", name: "US fluid ounce (fl oz)", toSI: 2.95735295625e-5 },
      { id: "cup", name: "US cup", toSI: 2.365882365e-4 },
      { id: "gal", name: "US gallon (gal)", toSI: 3.785411784e-3 },
      { id: "ft3", name: "Cubic foot (ft³)", toSI: 0.028316846592 },
    ],
  },
  {
    id: "speed", name: "Speed",
    units: [
      { id: "ms", name: "Metre/second (m/s)", toSI: 1 },
      { id: "kmh", name: "Kilometre/hour (km/h)", toSI: 1000 / 3600 },
      { id: "mph", name: "Mile/hour (mph)", toSI: 1609.344 / 3600 },
      { id: "kn", name: "Knot (kn)", toSI: 1852 / 3600 },
    ],
  },
  {
    id: "pressure", name: "Pressure",
    units: [
      { id: "pa", name: "Pascal (Pa)", toSI: 1 },
      { id: "kpa", name: "Kilopascal (kPa)", toSI: 1000 },
      { id: "bar", name: "Bar", toSI: 1e5 },
      { id: "atm", name: "Atmosphere (atm)", toSI: 101325 },
      { id: "mmhg", name: "mmHg (torr-ish)", toSI: 133.322387415 },
      { id: "psi", name: "psi", toSI: 6894.757293168 },
    ],
  },
  {
    id: "energy", name: "Energy",
    units: [
      { id: "j", name: "Joule (J)", toSI: 1 },
      { id: "kj", name: "Kilojoule (kJ)", toSI: 1000 },
      { id: "cal", name: "Calorie (cal)", toSI: 4.184 },
      { id: "kcal", name: "Kilocalorie (kcal)", toSI: 4184 },
      { id: "wh", name: "Watt-hour (Wh)", toSI: 3600 },
      { id: "kwh", name: "Kilowatt-hour (kWh)", toSI: 3.6e6 },
      { id: "ev", name: "Electron volt (eV)", toSI: 1.602176634e-19 },
      { id: "btu", name: "BTU (IT)", toSI: 1055.05585262 },
    ],
  },
  {
    id: "power", name: "Power",
    units: [
      { id: "w", name: "Watt (W)", toSI: 1 },
      { id: "kw", name: "Kilowatt (kW)", toSI: 1000 },
      { id: "hp", name: "Horsepower (mech.)", toSI: 745.6998715822702 },
    ],
  },
];

const tempToC = (v: number, unit: string): number =>
  unit === "c" ? v : unit === "f" ? (v - 32) / 1.8 : v - 273.15;
const tempFromC = (c: number, unit: string): number =>
  unit === "c" ? c : unit === "f" ? c * 1.8 + 32 : c + 273.15;

export function convertUnit(categoryId: string, fromId: string, toId: string, value: number): number {
  const cat = CONVERSIONS.find((c) => c.id === categoryId);
  if (!cat) throw new Error(`Unknown conversion category ${categoryId}`);
  const from = cat.units.find((u) => u.id === fromId);
  const to = cat.units.find((u) => u.id === toId);
  if (!from || !to) throw new Error("Unknown unit");
  if (cat.id === "temp") {
    const c = tempToC(value, fromId);
    const out = tempFromC(c, toId);
    if (toId === "k" && out < 0) throw new Error("Result is below absolute zero");
    return out;
  }
  return (value * from.toSI) / to.toSI;
}
