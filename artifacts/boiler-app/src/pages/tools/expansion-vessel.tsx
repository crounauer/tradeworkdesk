/**
 * Expansion Vessel Calculator
 * Standards:
 *   - BS EN 12828:2012 (heating systems in buildings — design of hot water systems)
 *   - BS EN 13831:2007 (closed expansion vessels — requirements)
 *   - BS 7074-1:1989 (expansion vessels for sealed hot water systems)
 *   - CIBSE CP1:2020 (heat networks — Code of Practice)
 *
 * Formula (BS EN 12828 / BS 7074-1):
 *   V_vessel = (V_system × e) / (1 - (P₀ + 1) / (Ps + 1))
 *
 *   Where:
 *     V_system = total water content of system (litres)
 *     e        = expansion factor (water expansion coefficient from cold fill to max temp)
 *     P₀       = pre-charge pressure (bar g) = static head + 0.2 bar
 *     Ps       = safety valve setting (bar g) — vessel must be sized for Ps not PS × 0.9
 *     All pressures in bar absolute for the formula (add 1 to gauge pressures)
 *
 * Expansion factor e for water/glycol (BS EN 12828 Table C.1 / ASHRAE):
 *   Pure water:      0.034 at 70°C, 0.0455 at 80°C, 0.061 at 90°C
 *   25% propylene glycol: +0.3% absolute over water
 *   40% propylene glycol: +0.9% absolute over water
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookmarkPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";

// Standard commercial expansion vessel sizes (litres) — EN 13831
const STANDARD_SIZES = [2, 5, 8, 12, 18, 24, 25, 35, 50, 80, 100, 150, 200];

function nearestStandardSize(calc: number): number {
  return STANDARD_SIZES.find(s => s >= calc) ?? STANDARD_SIZES[STANDARD_SIZES.length - 1];
}

// Expansion factor (fraction) for water and glycol mixes
// Based on BS EN 12828 Annex C and CIBSE data
// e = (volume at max temp - volume at fill temp) / volume at fill temp
// Fill temp assumed 10°C for all cases
function expansionFactor(maxTemp: number, glycolPct: number): number {
  // Pure water expansion relative to 10°C
  // Polynomial fit to BS EN 12828 Table C.1 data points
  const tempFrac = ((maxTemp / 100) ** 2 * 0.0367 + (maxTemp / 100) * 0.0258 - 0.0025);
  // Glycol correction: propylene glycol increases expansion
  const glycolCorrection = glycolPct * 0.000012; // per percent concentration
  return Math.max(0, tempFrac + glycolCorrection);
}

type GlycolType = "none" | "propylene" | "ethylene";

export default function ExpansionVessel() {
  const [systemVolume, setSystemVolume] = useState("");
  const [staticHead, setStaticHead] = useState("1.0");    // bar g (fill pressure)
  const [safetyValve, setSafetyValve] = useState("3.0");  // bar g
  const [maxTemp, setMaxTemp] = useState("80");           // °C
  const [glycolType, setGlycolType] = useState<GlycolType>("none");
  const [glycolPct, setGlycolPct] = useState("0");
  const [existingVesselSize, setExistingVesselSize] = useState(""); // litres — optional
  const [saveOpen, setSaveOpen] = useState(false);

  const calc = useMemo(() => {
    const Vs = parseFloat(systemVolume) || 0;
    const P0 = parseFloat(staticHead) || 1.0;   // bar g
    const Ps = parseFloat(safetyValve) || 3.0;  // bar g
    const T  = parseFloat(maxTemp) || 80;
    const gPct = glycolType !== "none" ? (parseFloat(glycolPct) || 0) : 0;

    if (Vs <= 0) return null;

    const e = expansionFactor(T, gPct);
    // BS 7074-1 formula: Vv = (Vs × e) / (1 - (P0+1)/(Ps+1))
    const denominator = 1 - (P0 + 1) / (Ps + 1);
    if (denominator <= 0) return null;

    const Vv = (Vs * e) / denominator;
    const recommended = nearestStandardSize(Math.ceil(Vv * 1.1)); // +10% safety margin per CIBSE CP1

    return { e, Vv, recommended, P0, Ps, T, gPct };
  }, [systemVolume, staticHead, safetyValve, maxTemp, glycolType, glycolPct]);

  const existingVesselOk = calc && existingVesselSize
    ? parseFloat(existingVesselSize) >= calc.Vv
    : null;

  function formatResult(): string {
    if (!calc) return "Expansion Vessel Calculation — insufficient data entered";
    const lines = [
      "EXPANSION VESSEL CALCULATION",
      "Standard: BS EN 12828:2012, BS EN 13831, BS 7074-1:1989",
      `System water volume: ${systemVolume} L`,
      `Pre-charge pressure P₀: ${calc.P0} bar g`,
      `Safety valve setting Ps: ${calc.Ps} bar g`,
      `Maximum system temperature: ${calc.T} °C`,
      `Fluid: ${glycolType === "none" ? "Water" : `${glycolPct}% ${glycolType} glycol`}`,
      `Expansion factor e: ${(calc.e * 100).toFixed(2)}%`,
      ``,
      `CALCULATED VESSEL SIZE: ${calc.Vv.toFixed(1)} L`,
      `With 10% safety margin: ${(calc.Vv * 1.1).toFixed(1)} L`,
      `RECOMMENDED STANDARD SIZE: ${calc.recommended} L`,
      `Pre-charge pressure to set: ${calc.P0} bar g (= static head)`,
    ];
    if (existingVesselSize) {
      lines.push(`Existing vessel: ${existingVesselSize} L — ${existingVesselOk ? "ADEQUATE" : "UNDERSIZED — replacement required"}`);
    }
    return lines.join("\n");
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Expansion Vessel Calculator</h1>
        <p className="text-muted-foreground text-sm mt-1">BS EN 12828 · BS EN 13831 · BS 7074-1 · CIBSE CP1</p>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">System Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">System Water Volume (litres)</Label>
            <Input value={systemVolume} onChange={e => setSystemVolume(e.target.value)} placeholder="e.g. 80" />
            <p className="text-xs text-muted-foreground mt-1">Boiler + pipework + radiators. Estimate: ~8–12 L/kW for traditional systems.</p>
          </div>
          <div>
            <Label className="text-xs">Fill / Static Head Pressure (bar g)</Label>
            <Input value={staticHead} onChange={e => setStaticHead(e.target.value)} placeholder="1.0" />
            <p className="text-xs text-muted-foreground mt-1">Also used as vessel pre-charge pressure.</p>
          </div>
          <div>
            <Label className="text-xs">Safety Valve Setting (bar g)</Label>
            <Input value={safetyValve} onChange={e => setSafetyValve(e.target.value)} placeholder="3.0" />
          </div>
          <div>
            <Label className="text-xs">Maximum System Temperature (°C)</Label>
            <Input value={maxTemp} onChange={e => setMaxTemp(e.target.value)} placeholder="80" />
          </div>
          <div>
            <Label className="text-xs">System Fluid</Label>
            <Select value={glycolType} onValueChange={v => setGlycolType(v as GlycolType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Water only</SelectItem>
                <SelectItem value="propylene">Propylene glycol mix</SelectItem>
                <SelectItem value="ethylene">Ethylene glycol mix</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {glycolType !== "none" && (
            <div>
              <Label className="text-xs">Glycol Concentration (%)</Label>
              <Input value={glycolPct} onChange={e => setGlycolPct(e.target.value)} placeholder="25" />
            </div>
          )}
        </div>
      </Card>

      {calc && (
        <>
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-purple-50 p-3">
                <div className="text-xs text-muted-foreground">Expansion Factor</div>
                <div className="text-2xl font-bold text-purple-700">{(calc.e * 100).toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground">at {calc.T}°C {glycolType !== "none" ? `+ ${glycolPct}% glycol` : ""}</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <div className="text-xs text-muted-foreground">Calculated Size (BS 7074-1)</div>
                <div className="text-2xl font-bold text-purple-700">{calc.Vv.toFixed(1)} L</div>
                <div className="text-xs text-muted-foreground">+10% safety margin → {(calc.Vv * 1.1).toFixed(1)} L</div>
              </div>
              <div className="rounded-lg bg-purple-100 p-3 border border-purple-200">
                <div className="text-xs text-muted-foreground">Specify this standard size</div>
                <div className="text-2xl font-bold text-purple-800">{calc.recommended} L</div>
                <div className="text-xs text-muted-foreground">Pre-charge: {calc.P0} bar g</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-slate-50 rounded p-2">
              Formula (BS 7074-1): V = (Vs × e) / (1 − (P₀+1)/(Ps+1)) = ({systemVolume} × {(calc.e).toFixed(4)}) / (1 − {(calc.P0+1).toFixed(1)}/{(calc.Ps+1).toFixed(1)}) = {calc.Vv.toFixed(2)} L
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">Existing Vessel Check (optional)</h2>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-xs">Existing vessel size (litres)</Label>
                <Input value={existingVesselSize} onChange={e => setExistingVesselSize(e.target.value)} placeholder="e.g. 12" className="mt-1" />
              </div>
              {existingVesselSize && (
                <div className="pb-1">
                  {existingVesselOk
                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1"><CheckCircle2 className="w-3 h-3" /> Adequate</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 rounded px-2 py-1"><AlertCircle className="w-3 h-3" /> Undersized</span>}
                </div>
              )}
            </div>
            {existingVesselSize && !existingVesselOk && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded p-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Existing vessel ({existingVesselSize} L) is undersized for this system. A minimum {calc.recommended} L vessel is required. Undersized expansion vessels lead to repeated pressure relief valve operation and system waterlogging.
              </div>
            )}
          </Card>
        </>
      )}

      <Button onClick={() => setSaveOpen(true)} className="gap-2"><BookmarkPlus className="w-4 h-4" /> Save to Job</Button>
      <SaveToJobDialog open={saveOpen} onClose={() => setSaveOpen(false)} content={formatResult()} toolName="Expansion Vessel Calculation" />
    </div>
  );
}
