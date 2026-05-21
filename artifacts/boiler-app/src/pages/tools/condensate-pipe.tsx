/**
 * Condensate Pipe Sizing & Route Checklist
 * Standards:
 *   - BS EN 13384-1 (condensate drainage from fuel burning appliances)
 *   - Building Regulations Part H (drainage)
 *   - HHIC Guidance Note CN-01 (condensate pipe best practice)
 *   - Manufacturer guidance (typically 22 mm min internal, 32 mm for external >3 m)
 *
 * Key rules:
 *   - Minimum 22 mm internal diameter for ALL runs (HHIC CN-01)
 *   - External runs >3 m: must use 32 mm minimum (HHIC CN-01)
 *   - Minimum fall: 2.5° (≈44 mm per metre) — Part H / HHIC
 *   - Trap depth: minimum 75 mm water seal for internal, 125 mm for external
 *   - External runs: insulate to protect against freezing (Building Regs L1A / HHIC)
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookmarkPlus, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";

type RouteType = "internal_only" | "partly_external" | "fully_external";
type PipeDia = "22" | "32" | "40";
type DischargePoint = "internal_drain" | "external_drain" | "soakaway" | "condensate_pump";

function ResultBadge({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="text-xs text-muted-foreground bg-slate-100 rounded px-2 py-0.5">Not checked</span>;
  if (pass) return <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> PASS</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 rounded px-2 py-0.5"><XCircle className="w-3 h-3" /> FAIL</span>;
}

export default function CondensatePipe() {
  const [routeType, setRouteType] = useState<RouteType>("internal_only");
  const [externalRunLength, setExternalRunLength] = useState("");
  const [pipeDia, setPipeDia] = useState<PipeDia>("22");
  const [fallMmPerM, setFallMmPerM] = useState("");
  const [trapDepth, setTrapDepth] = useState("");
  const [dischargePoint, setDischargePoint] = useState<DischargePoint>("internal_drain");
  const [insulated, setInsulated] = useState<"yes" | "no" | "">("");
  const [antiSiphon, setAntiSiphon] = useState<"yes" | "no" | "">("");
  const [airBreak, setAirBreak] = useState<"yes" | "no" | "">("");
  const [saveOpen, setSaveOpen] = useState(false);

  const extLen = parseFloat(externalRunLength) || 0;
  const fallVal = parseFloat(fallMmPerM) || 0;
  const trapVal = parseFloat(trapDepth) || 0;

  // Pipe diameter recommendation
  const hasExternal = routeType !== "internal_only";
  const minDia = hasExternal && extLen > 3 ? 32 : 22;
  const diaPass = parseInt(pipeDia) >= minDia;

  // Fall check: minimum 2.5° = 44 mm per metre (HHIC CN-01 / Part H)
  const MIN_FALL = 44;
  const fallPass = fallVal > 0 ? fallVal >= MIN_FALL : null;

  // Trap depth: 75 mm internal, 125 mm external (HHIC CN-01)
  const minTrap = hasExternal ? 125 : 75;
  const trapPass = trapVal > 0 ? trapVal >= minTrap : null;

  // Insulation required for external runs
  const insulationRequired = hasExternal;
  const insulationPass = !insulationRequired ? null : insulated === "yes" ? true : insulated === "no" ? false : null;

  // Anti-siphon check
  const antiSiphonPass = antiSiphon === "yes" ? true : antiSiphon === "no" ? false : null;

  // Air break at discharge
  const airBreakRequired = dischargePoint === "external_drain" || dischargePoint === "soakaway";
  const airBreakPass = !airBreakRequired ? null : airBreak === "yes" ? true : airBreak === "no" ? false : null;

  // Condensate flow rate estimate: approx 1–2 L per kWh of condensation
  // We don't require kW input, just note the sizing

  const allChecksPassed = diaPass && fallPass !== false && trapPass !== false && insulationPass !== false && antiSiphonPass !== false && airBreakPass !== false;

  function formatResult(): string {
    const lines = [
      "CONDENSATE PIPE SIZING & ROUTE CHECKLIST",
      "Standard: BS EN 13384-1, Building Regulations Part H, HHIC Guidance Note CN-01",
      `Route type: ${routeType.replace(/_/g, " ")}`,
      `External run length: ${hasExternal ? (externalRunLength || "–") + " m" : "N/A"}`,
      `Pipe diameter selected: ${pipeDia} mm (minimum required: ${minDia} mm) — ${diaPass ? "PASS" : "FAIL"}`,
      `Pipe fall: ${fallMmPerM || "–"} mm/m (minimum 44 mm/m = 2.5°) — ${fallPass === null ? "not entered" : fallPass ? "PASS" : "FAIL"}`,
      `Trap depth: ${trapDepth || "–"} mm (minimum ${minTrap} mm) — ${trapPass === null ? "not entered" : trapPass ? "PASS" : "FAIL"}`,
      `Discharge point: ${dischargePoint.replace(/_/g, " ")}`,
    ];
    if (insulationRequired) lines.push(`External pipe insulated: ${insulated || "–"} — ${insulationPass === null ? "not entered" : insulationPass ? "PASS" : "FAIL"}`);
    lines.push(`Anti-siphon provision: ${antiSiphon || "–"} — ${antiSiphonPass === null ? "not entered" : antiSiphonPass ? "PASS" : "FAIL"}`);
    if (airBreakRequired) lines.push(`Air break at discharge: ${airBreak || "–"} — ${airBreakPass === null ? "not entered" : airBreakPass ? "PASS" : "FAIL"}`);
    lines.push("");
    lines.push(`OVERALL: ${allChecksPassed ? "ALL CHECKS PASSED" : "ACTION REQUIRED — see items above"}`);
    return lines.join("\n");
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Condensate Pipe Sizing</h1>
        <p className="text-muted-foreground text-sm mt-1">BS EN 13384 · Building Regulations Part H · HHIC CN-01</p>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Route & Sizing</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-1">
            <Label className="text-xs">Route Type</Label>
            <Select value={routeType} onValueChange={v => setRouteType(v as RouteType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_only">Internal only</SelectItem>
                <SelectItem value="partly_external">Partly external</SelectItem>
                <SelectItem value="fully_external">Fully external</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasExternal && (
            <div>
              <Label className="text-xs">External Run Length (m)</Label>
              <Input value={externalRunLength} onChange={e => setExternalRunLength(e.target.value)} placeholder="e.g. 5" />
            </div>
          )}
          <div>
            <Label className="text-xs">Discharge Point</Label>
            <Select value={dischargePoint} onValueChange={v => setDischargePoint(v as DischargePoint)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_drain">Internal drain / soil stack</SelectItem>
                <SelectItem value="external_drain">External drain / gully</SelectItem>
                <SelectItem value="soakaway">Condensate soakaway</SelectItem>
                <SelectItem value="condensate_pump">Condensate pump</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pipe diameter recommendation */}
        <div className={`rounded-lg p-3 text-sm ${diaPass ? "bg-emerald-50" : "bg-red-50"}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">Minimum pipe diameter: <strong>{minDia} mm</strong></span>
            <ResultBadge pass={diaPass} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {hasExternal && extLen > 3
              ? "External run >3 m: 32 mm minimum required (HHIC CN-01)"
              : "All runs: 22 mm minimum (HHIC CN-01)"}
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs">Pipe Diameter Selected</Label>
            <Select value={pipeDia} onValueChange={v => setPipeDia(v as PipeDia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="22">22 mm</SelectItem>
                <SelectItem value="32">32 mm</SelectItem>
                <SelectItem value="40">40 mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pb-1"><ResultBadge pass={diaPass} /></div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Fall & Trap</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Pipe Fall (mm per metre) — min 44 mm/m (2.5°)</Label>
            <Input value={fallMmPerM} onChange={e => setFallMmPerM(e.target.value)} placeholder="44" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">1° = 17.5 mm/m · 2.5° = 44 mm/m · 5° = 87 mm/m</p>
          </div>
          <div className="flex flex-col justify-between">
            <div></div>
            <ResultBadge pass={fallPass} />
          </div>

          <div>
            <Label className="text-xs">Trap Water Seal Depth (mm) — min {minTrap} mm</Label>
            <Input value={trapDepth} onChange={e => setTrapDepth(e.target.value)} placeholder={minTrap.toString()} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">{hasExternal ? "External route: 125 mm minimum (HHIC CN-01)" : "Internal route: 75 mm minimum (HHIC CN-01)"}</p>
          </div>
          <div className="flex flex-col justify-end pb-6">
            <ResultBadge pass={trapPass} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">Additional Checks</h2>
        {insulationRequired && (
          <div className="flex items-center justify-between">
            <Label className="text-xs">External pipe insulated to prevent freezing? (HHIC CN-01)</Label>
            <Select value={insulated} onValueChange={v => setInsulated(v as any)}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Anti-siphon provision at appliance trap?</Label>
          <Select value={antiSiphon} onValueChange={v => setAntiSiphon(v as any)}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {airBreakRequired && (
          <div className="flex items-center justify-between">
            <Label className="text-xs">Air break provided at discharge point? (Part H)</Label>
            <Select value={airBreak} onValueChange={v => setAirBreak(v as any)}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {hasExternal && insulated === "no" && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            External condensate pipes must be insulated to prevent freezing. HHIC CN-01 and Building Regs Part L require frost protection on external condensate pipework.
          </div>
        )}
      </Card>

      <Card className={`p-4 ${allChecksPassed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-center gap-2">
          {allChecksPassed
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            : <AlertCircle className="w-5 h-5 text-amber-500" />}
          <span className={`font-semibold text-sm ${allChecksPassed ? "text-emerald-700" : "text-amber-700"}`}>
            {allChecksPassed ? "Condensate installation meets requirements" : "Complete all checks above before signing off"}
          </span>
        </div>
      </Card>

      <Button onClick={() => setSaveOpen(true)} className="gap-2"><BookmarkPlus className="w-4 h-4" /> Save to Job</Button>
      <SaveToJobDialog open={saveOpen} onClose={() => setSaveOpen(false)} content={formatResult()} toolName="Condensate Pipe Check" />
    </div>
  );
}
