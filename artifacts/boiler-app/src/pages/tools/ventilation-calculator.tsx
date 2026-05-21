/**
 * Ventilation Air Calculator for Oil-Fired Appliances
 * Standards: BS 5410-1:2014, OFTEC OFS D200, Building Regulations Part J
 *
 * For conventional (open) flue oil appliances:
 *   Each vent opening: 550 mm² per kW of rated heat input (net)
 *   Two-level ventilation (high + low): 275 mm² per kW each
 *   Minimum free area for any opening: 2000 mm² (BS 5410-1 Cl 7.3.2)
 *   Grille free-area factor: 50% for louvred (i.e. gross size = 2× free area)
 *
 * Room-sealed / balanced flue: no room ventilation required for combustion air
 * (but may require ventilation for cooling — check manufacturer instructions)
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookmarkPlus, CheckCircle2, XCircle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";
import { SEOHead } from "@/components/seo-head";

type FlueTye = "open_flue" | "room_sealed" | "balanced_flue";
type VentConfig = "combined" | "two_level";
type GrilleFactor = "free" | "louvred" | "mesh";

const GRILLE_FACTORS: Record<GrilleFactor, number> = {
  free:    1.0,   // unobstructed opening
  louvred: 0.5,   // louvred grille — 50% free area (BS 5410-1)
  mesh:    0.7,   // mesh grille — 70% free area (BS 5410-1)
};

function passCheck(entered: string, required: number): boolean | null {
  const v = parseFloat(entered);
  if (isNaN(v) || entered === "") return null;
  return v >= required;
}

function ResultBadge({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="text-xs text-muted-foreground bg-slate-100 rounded px-2 py-0.5">Not entered</span>;
  if (pass) return <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> PASS</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 rounded px-2 py-0.5"><XCircle className="w-3 h-3" /> FAIL</span>;
}

export default function VentilationCalculator() {
  const [flueTye, setFlueType] = useState<FlueTye>("open_flue");
  const [kw, setKw] = useState("");
  const [ventConfig, setVentConfig] = useState<VentConfig>("two_level");
  const [grilleFactor, setGrilleFactor] = useState<GrilleFactor>("louvred");

  // Existing ventilation measurements
  const [existingLow, setExistingLow] = useState("");  // mm² free area
  const [existingHigh, setExistingHigh] = useState(""); // mm² free area

  const [saveOpen, setSaveOpen] = useState(false);

  const kW = parseFloat(kw) || 0;
  const gf = GRILLE_FACTORS[grilleFactor];

  // BS 5410-1 Cl 7.3.2: 550 mm² per kW per level
  const MIN_ANY = 2000; // mm² minimum regardless of kW

  let reqLowFree = 0; // mm² free area required low-level
  let reqHighFree = 0; // mm² free area required high-level
  let reqLowGross = 0; // mm² gross opening size (allows for grille factor)
  let reqHighGross = 0;

  if (flueTye === "open_flue" && kW > 0) {
    if (ventConfig === "combined") {
      // Single combined vent
      reqLowFree = Math.max(kW * 550, MIN_ANY);
      reqLowGross = Math.ceil(reqLowFree / gf);
      reqHighFree = 0;
      reqHighGross = 0;
    } else {
      // Two-level: 275 mm² per kW each
      reqLowFree  = Math.max(kW * 275, MIN_ANY);
      reqHighFree = Math.max(kW * 275, MIN_ANY);
      reqLowGross  = Math.ceil(reqLowFree / gf);
      reqHighGross = Math.ceil(reqHighFree / gf);
    }
  }

  const lowPass  = flueTye === "open_flue" ? passCheck(existingLow,  reqLowFree)  : null;
  const highPass = (flueTye === "open_flue" && ventConfig === "two_level") ? passCheck(existingHigh, reqHighFree) : null;

  // Equivalent grille dimensions (square root to give side of square grille in mm)
  const lowSide  = reqLowGross  > 0 ? Math.ceil(Math.sqrt(reqLowGross))  : 0;
  const highSide = reqHighGross > 0 ? Math.ceil(Math.sqrt(reqHighGross)) : 0;

  function formatResult(): string {
    const lines = [
      "VENTILATION AIR CALCULATION",
      "Standard: BS 5410-1:2014, OFTEC OFS D200, Building Regulations Part J",
      `Appliance flue type: ${flueTye.replace("_", " ")}`,
      `Rated heat input: ${kw || "–"} kW`,
      `Ventilation configuration: ${ventConfig === "two_level" ? "Two-level (high + low)" : "Combined single opening"}`,
      `Grille type: ${grilleFactor} (free area factor ${(gf * 100).toFixed(0)}%)`,
      "",
    ];
    if (flueTye !== "open_flue") {
      lines.push("Room-sealed / balanced flue appliance — no room combustion air ventilation required.");
      lines.push("Refer to appliance manufacturer for any cooling ventilation requirements.");
    } else if (kW > 0) {
      lines.push(`LOW-LEVEL VENT: Required free area ${reqLowFree.toFixed(0)} mm² → Gross opening ${reqLowGross.toFixed(0)} mm² (≈ ${lowSide}×${lowSide} mm square grille)`);
      lines.push(`Existing low-level vent free area: ${existingLow || "–"} mm² — ${lowPass === null ? "not entered" : lowPass ? "PASS" : "FAIL"}`);
      if (ventConfig === "two_level") {
        lines.push(`HIGH-LEVEL VENT: Required free area ${reqHighFree.toFixed(0)} mm² → Gross opening ${reqHighGross.toFixed(0)} mm² (≈ ${highSide}×${highSide} mm square grille)`);
        lines.push(`Existing high-level vent free area: ${existingHigh || "–"} mm² — ${highPass === null ? "not entered" : highPass ? "PASS" : "FAIL"}`);
      }
    }
    return lines.join("\n");
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <SEOHead
        title="Combustion Air Ventilation Calculator — BS 5410-1"
        description="Size combustion air openings for oil and gas-fired appliances. Free calculator for heating engineers, compliant with BS 5410-1:2014 and OFTEC OFS D200."
        canonical="https://www.tradeworkdesk.co.uk/tools/ventilation-calculator"
      />
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Ventilation Air Calculator</h1>
        <p className="text-muted-foreground text-sm mt-1">BS 5410-1:2014 · OFTEC OFS D200 · Building Regulations Part J</p>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Appliance Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-1">
            <Label className="text-xs">Flue Type</Label>
            <Select value={flueTye} onValueChange={v => setFlueType(v as FlueTye)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open_flue">Conventional / Open Flue (Type A)</SelectItem>
                <SelectItem value="room_sealed">Room Sealed (Type B/C)</SelectItem>
                <SelectItem value="balanced_flue">Balanced Flue (Type C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rated Heat Input (kW net)</Label>
            <Input value={kw} onChange={e => setKw(e.target.value)} placeholder="e.g. 26" />
          </div>
          {flueTye === "open_flue" && (
            <>
              <div>
                <Label className="text-xs">Ventilation Configuration</Label>
                <Select value={ventConfig} onValueChange={v => setVentConfig(v as VentConfig)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="two_level">Two-level (high + low)</SelectItem>
                    <SelectItem value="combined">Combined single opening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Grille / Opening Type</Label>
                <Select value={grilleFactor} onValueChange={v => setGrilleFactor(v as GrilleFactor)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="louvred">Louvred grille (50% free)</SelectItem>
                    <SelectItem value="mesh">Mesh/insect grille (70% free)</SelectItem>
                    <SelectItem value="free">Unobstructed opening (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </Card>

      {flueTye === "open_flue" && kW > 0 && (
        <>
          <Card className="p-4 space-y-4">
            <h2 className="font-semibold text-sm">Required Ventilation</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-teal-50 p-3 space-y-1">
                <div className="text-xs font-medium text-teal-700 uppercase tracking-wide">Low-Level Inlet</div>
                <div className="text-2xl font-bold">{reqLowFree.toFixed(0)} mm²</div>
                <div className="text-xs text-muted-foreground">free area required</div>
                <div className="text-sm font-medium">{reqLowGross.toFixed(0)} mm² gross opening</div>
                <div className="text-xs text-muted-foreground">≈ {lowSide} × {lowSide} mm square grille ({(gf*100).toFixed(0)}% free)</div>
              </div>
              {ventConfig === "two_level" && (
                <div className="rounded-lg bg-teal-50 p-3 space-y-1">
                  <div className="text-xs font-medium text-teal-700 uppercase tracking-wide">High-Level Outlet</div>
                  <div className="text-2xl font-bold">{reqHighFree.toFixed(0)} mm²</div>
                  <div className="text-xs text-muted-foreground">free area required</div>
                  <div className="text-sm font-medium">{reqHighGross.toFixed(0)} mm² gross opening</div>
                  <div className="text-xs text-muted-foreground">≈ {highSide} × {highSide} mm square grille</div>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-slate-50 rounded p-2">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              BS 5410-1 Cl 7.3.2: 550 mm² per kW heat input (per opening). Two-level: 275 mm² per kW each. Minimum 2,000 mm² for any opening.
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h2 className="font-semibold text-sm">Existing Ventilation Check</h2>
            <p className="text-xs text-muted-foreground">Enter the measured free area of existing openings in mm².</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs">Existing low-level vent free area (mm²)</Label>
                  <Input value={existingLow} onChange={e => setExistingLow(e.target.value)} placeholder={reqLowFree.toFixed(0)} className="mt-1" />
                </div>
                <div className="pb-0.5"><ResultBadge pass={lowPass} /></div>
              </div>
              {ventConfig === "two_level" && (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">Existing high-level vent free area (mm²)</Label>
                    <Input value={existingHigh} onChange={e => setExistingHigh(e.target.value)} placeholder={reqHighFree.toFixed(0)} className="mt-1" />
                  </div>
                  <div className="pb-0.5"><ResultBadge pass={highPass} /></div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {flueTye !== "open_flue" && (
        <Card className="p-4">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
            <span>Room-sealed / balanced flue — <strong>no room ventilation required</strong> for combustion air (BS 5410-1). Refer to appliance installation manual for any cooling requirements.</span>
          </div>
        </Card>
      )}

      <Button onClick={() => setSaveOpen(true)} className="gap-2"><BookmarkPlus className="w-4 h-4" /> Save to Job</Button>

      <SaveToJobDialog open={saveOpen} onClose={() => setSaveOpen(false)} content={formatResult()} toolName="Ventilation Air Calculation" />
    </div>
  );
}
