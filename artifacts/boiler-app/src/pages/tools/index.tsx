import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Calculator, Droplets, Wind, Flame, Waves, Gauge, Zap, FlameKindling } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Category = "all" | "gas" | "oil" | "heat-pump" | "general";

interface Tool {
  href: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  subtitle: string;
  description: string;
  categories: Exclude<Category, "all">[];
}

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all",       label: "All Tools" },
  { key: "gas",       label: "Gas" },
  { key: "oil",       label: "Oil" },
  { key: "heat-pump", label: "Heat Pumps" },
  { key: "general",   label: "General" },
];

const tools: Tool[] = [
  {
    href: "/tools/radiator-sizing",
    icon: Flame,
    color: "text-orange-500",
    bg: "bg-orange-50",
    title: "Radiator Sizing",
    subtitle: "BS EN 442",
    description: "Calculate room heat loss and corrected radiator output at any system flow temperature.",
    categories: ["general", "heat-pump"],
  },
  {
    href: "/tools/oil-tank-location",
    icon: Droplets,
    color: "text-blue-500",
    bg: "bg-blue-50",
    title: "Oil Tank Location",
    subtitle: "OFTEC OFS T100 · Part J",
    description: "Check oil tank siting distances, bund requirements and secondary containment volumes.",
    categories: ["oil"],
  },
  {
    href: "/tools/ventilation-calculator",
    icon: Wind,
    color: "text-teal-500",
    bg: "bg-teal-50",
    title: "Ventilation Air Calculator",
    subtitle: "BS 5410-1 · OFTEC OFS D200",
    description: "Size combustion air openings for oil-fired appliances — high-level and low-level vents.",
    categories: ["gas", "oil"],
  },
  {
    href: "/tools/gas-flue-siting",
    icon: FlameKindling,
    color: "text-amber-500",
    bg: "bg-amber-50",
    title: "Gas Flue Siting Checklist",
    subtitle: "BS 5440-1:2008 · Gas Safety Regs 1998 · Part J",
    description: "Check gas flue terminal clearances for room-sealed and open-flue appliances.",
    categories: ["gas"],
  },
  {
    href: "/tools/flue-siting",
    icon: Zap,
    color: "text-orange-500",
    bg: "bg-orange-50",
    title: "Oil Flue Siting Checklist",
    subtitle: "OFTEC OFS T200 · BS 5410-1 · Part J",
    description: "Check oil flue terminal clearances from windows, doors, boundaries and other obstacles.",
    categories: ["oil"],
  },
  {
    href: "/tools/condensate-pipe",
    icon: Waves,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
    title: "Condensate Pipe Sizing",
    subtitle: "BS EN 13384 · Part H · HHIC CN-01",
    description: "Size condensate pipework and check routing, falls, trap depth and freeze protection.",
    categories: ["gas"],
  },
  {
    href: "/tools/expansion-vessel",
    icon: Gauge,
    color: "text-purple-500",
    bg: "bg-purple-50",
    title: "Expansion Vessel Calculator",
    subtitle: "BS EN 12828 · BS 7074-1 · CIBSE CP1",
    description: "Calculate minimum expansion vessel size for sealed heating systems including glycol.",
    categories: ["general", "gas", "heat-pump"],
  },
  {
    href: "/tools/pump-head",
    icon: Calculator,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    title: "Pump Head & Pipe Sizing",
    subtitle: "CIBSE Guide C · BSRIA BG 2/2003",
    description: "Size pipework, check velocities and calculate total pump head for the index circuit.",
    categories: ["general", "gas", "heat-pump"],
  },
];

export default function ToolsIndex() {
  const [active, setActive] = useState<Category>("all");

  const visible = active === "all" ? tools : tools.filter(t => t.categories.includes(active as Exclude<Category, "all">));

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div>
        <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Engineering Tools</h1>
        <p className="text-muted-foreground mt-1">Calculators and checklists for heating and oil engineers. Results can be saved directly to jobs.</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              active === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {c.label}
            {c.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                {tools.filter(t => t.categories.includes(c.key as Exclude<Category, "all">)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No tools in this category yet — check back soon.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {visible.map(t => {
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border border-border/50 h-full">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${t.bg} shrink-0`}>
                      <Icon className={`w-5 h-5 ${t.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{t.title}</div>
                      <div className="text-xs text-muted-foreground mb-1">{t.subtitle}</div>
                      <div className="text-sm text-muted-foreground">{t.description}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.categories.map(cat => {
                          const label = CATEGORIES.find(c => c.key === cat)?.label ?? cat;
                          return (
                            <Badge key={cat} variant="secondary" className="text-xs px-1.5 py-0">
                              {label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
