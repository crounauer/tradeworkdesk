/**
 * Radiator Sizing Tool
 * Standard: BS EN 442 (radiator testing & correction factors)
 * EN 442 test conditions: flow 75°C, return 65°C, room 20°C → ΔT₀ = 50 K, exponent n ≈ 1.3
 * Correction factor: F = ((Tm - Ta) / ΔT₀)^n
 * where Tm = mean water temp, Ta = room design temp, ΔT₀ = 50 K
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Trash2, BookmarkPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";

// U-values (W/m²K) and infiltration by construction type
// Source: CIBSE Guide A Table 3.1 simplified
const INSULATION_PRESETS = {
  poor:      { label: "Poor (pre-1970s, uninsulated)",    uWall: 1.7, uRoof: 2.3, uFloor: 0.7, uWindow: 5.6, ach: 1.5 },
  standard:  { label: "Standard (1980s–2000s)",           uWall: 0.7, uRoof: 0.5, uFloor: 0.35, uWindow: 3.1, ach: 0.75 },
  good:      { label: "Good (post-2006 Part L)",          uWall: 0.35, uRoof: 0.25, uFloor: 0.22, uWindow: 2.0, ach: 0.5 },
  excellent: { label: "Excellent (Passivhaus standard)", uWall: 0.15, uRoof: 0.12, uFloor: 0.10, uWindow: 1.0, ach: 0.3 },
};

interface Room {
  id: string;
  name: string;
  length: string;
  width: string;
  height: string;
  insulation: keyof typeof INSULATION_PRESETS;
  targetTemp: string;
  // which surfaces are adjacent to unheated/outside
  exposedWalls: string; // number 1–4
  exposedFloor: boolean;
  exposedCeiling: boolean;
}

const defaultRoom = (): Room => ({
  id: Math.random().toString(36).slice(2),
  name: "Living Room",
  length: "5",
  width: "4",
  height: "2.4",
  insulation: "standard",
  targetTemp: "21",
  exposedWalls: "2",
  exposedFloor: false,
  exposedCeiling: false,
});

// BS EN 442 correction factor
function bsEn442CorrectionFactor(flowTemp: number, returnTemp: number, roomTemp: number): number {
  const Tm = (flowTemp + returnTemp) / 2;
  const dT = Tm - roomTemp;
  if (dT <= 0) return 0;
  return Math.pow(dT / 50, 1.3);
}

function calcRoomHeatLoss(room: Room, outsideTemp: number) {
  const preset = INSULATION_PRESETS[room.insulation];
  const L = parseFloat(room.length) || 0;
  const W = parseFloat(room.width) || 0;
  const H = parseFloat(room.height) || 0;
  const Ta = parseFloat(room.targetTemp) || 21;
  const dT = Ta - outsideTemp;

  const floorArea = L * W;
  const perimeter = 2 * (L + W);
  const wallArea = perimeter * H;
  const exposedWallArea = wallArea * (parseInt(room.exposedWalls) / 4);
  const windowArea = exposedWallArea * 0.15; // assume 15% glazing of exposed wall
  const netWallArea = exposedWallArea - windowArea;

  let loss = 0;
  loss += netWallArea * preset.uWall * dT;
  loss += windowArea * preset.uWindow * dT;
  if (room.exposedFloor)   loss += floorArea * preset.uFloor * dT;
  if (room.exposedCeiling) loss += floorArea * preset.uRoof * dT;

  // Infiltration: Q = 0.33 × N × V × dT (W) where N=ach, V=volume (m³)
  const volume = L * W * H;
  loss += 0.33 * preset.ach * volume * dT;

  return Math.round(loss);
}

function formatResult(rooms: Room[], flowTemp: number, returnTemp: number, outsideTemp: number): string {
  const F = bsEn442CorrectionFactor(flowTemp, returnTemp, 20); // EN442 uses 20°C room for factor
  let lines: string[] = [
    `RADIATOR SIZING CALCULATION`,
    `Standard: BS EN 442`,
    `System: ${flowTemp}°C flow / ${returnTemp}°C return`,
    `Outside design temp: ${outsideTemp}°C`,
    `EN 442 correction factor F = ${F.toFixed(3)}`,
    `(Mean water temp ${((flowTemp + returnTemp) / 2).toFixed(1)}°C, ΔT₀ 50 K, n=1.3)`,
    ``,
  ];
  rooms.forEach(r => {
    const loss = calcRoomHeatLoss(r, outsideTemp);
    const required = loss > 0 && F > 0 ? Math.round(loss / F) : 0;
    lines.push(`${r.name || "Room"}: ${loss} W heat loss → ${required} W radiator output required at ${flowTemp}/${returnTemp}°C`);
  });
  return lines.join("\n");
}

export default function RadiatorSizing() {
  const [rooms, setRooms] = useState<Room[]>([defaultRoom()]);
  const [flowTemp, setFlowTemp] = useState("70");
  const [returnTemp, setReturnTemp] = useState("50");
  const [outsideTemp, setOutsideTemp] = useState("-3");
  const [saveOpen, setSaveOpen] = useState(false);

  function updateRoom(id: string, patch: Partial<Room>) {
    setRooms(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }
  function addRoom() { setRooms(rs => [...rs, defaultRoom()]); }
  function removeRoom(id: string) { setRooms(rs => rs.filter(r => r.id !== id)); }

  const Ft = parseFloat(flowTemp) || 70;
  const Rt = parseFloat(returnTemp) || 50;
  const Ot = parseFloat(outsideTemp) || -3;
  const F = bsEn442CorrectionFactor(Ft, Rt, 20);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Radiator Sizing</h1>
        <p className="text-muted-foreground text-sm mt-1">BS EN 442 correction factors for any system flow temperature</p>
      </div>

      {/* System parameters */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">System Parameters</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">Flow Temp (°C)</Label>
            <Input value={flowTemp} onChange={e => setFlowTemp(e.target.value)} placeholder="70" />
          </div>
          <div>
            <Label className="text-xs">Return Temp (°C)</Label>
            <Input value={returnTemp} onChange={e => setReturnTemp(e.target.value)} placeholder="50" />
          </div>
          <div>
            <Label className="text-xs">Outside Design Temp (°C)</Label>
            <Input value={outsideTemp} onChange={e => setOutsideTemp(e.target.value)} placeholder="-3" />
          </div>
          <div className="flex flex-col justify-end">
            <div className="rounded-lg bg-orange-50 p-2 text-center">
              <div className="text-xs text-muted-foreground">EN 442 factor F</div>
              <div className="text-xl font-bold text-orange-600">{F.toFixed(3)}</div>
              <div className="text-xs text-muted-foreground">Tm {((Ft+Rt)/2).toFixed(1)}°C</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          EN 442 test: 75°C flow / 65°C return / 20°C room (ΔT₀ = 50 K, n = 1.3). A radiator rated at 1000 W at test conditions outputs {Math.round(1000 * F)} W at your selected temperatures.
        </p>
      </Card>

      {/* Rooms */}
      <div className="space-y-4">
        {rooms.map((room, idx) => {
          const loss = calcRoomHeatLoss(room, Ot);
          const required = loss > 0 && F > 0 ? Math.round(loss / F) : 0;
          return (
            <Card key={room.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Room {idx + 1}</h3>
                {rooms.length > 1 && (
                  <button onClick={() => removeRoom(room.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Room Name</Label>
                  <Input value={room.name} onChange={e => updateRoom(room.id, { name: e.target.value })} placeholder="e.g. Living Room" />
                </div>
                <div>
                  <Label className="text-xs">Length (m)</Label>
                  <Input value={room.length} onChange={e => updateRoom(room.id, { length: e.target.value })} placeholder="5" />
                </div>
                <div>
                  <Label className="text-xs">Width (m)</Label>
                  <Input value={room.width} onChange={e => updateRoom(room.id, { width: e.target.value })} placeholder="4" />
                </div>
                <div>
                  <Label className="text-xs">Ceiling Height (m)</Label>
                  <Input value={room.height} onChange={e => updateRoom(room.id, { height: e.target.value })} placeholder="2.4" />
                </div>
                <div>
                  <Label className="text-xs">Target Temp (°C)</Label>
                  <Input value={room.targetTemp} onChange={e => updateRoom(room.id, { targetTemp: e.target.value })} placeholder="21" />
                </div>
                <div>
                  <Label className="text-xs">Exposed Walls (count)</Label>
                  <Select value={room.exposedWalls} onValueChange={v => updateRoom(room.id, { exposedWalls: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1","2","3","4"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Construction / Insulation</Label>
                  <Select value={room.insulation} onValueChange={v => updateRoom(room.id, { insulation: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INSULATION_PRESETS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={room.exposedFloor} onChange={e => updateRoom(room.id, { exposedFloor: e.target.checked })} />
                  Exposed/unheated floor
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={room.exposedCeiling} onChange={e => updateRoom(room.id, { exposedCeiling: e.target.checked })} />
                  Exposed/unheated ceiling
                </label>
              </div>

              {loss > 0 && (
                <div className="rounded-lg bg-orange-50 p-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Room Heat Loss</div>
                    <div className="font-bold text-lg">{loss.toLocaleString()} W</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Radiator Required at {Ft}/{Rt}°C</div>
                    <div className="font-bold text-lg text-orange-600">{required.toLocaleString()} W</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Correction Factor F</div>
                    <div className="font-bold text-lg">{F.toFixed(3)}</div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={addRoom} className="gap-2"><Plus className="w-4 h-4" /> Add Room</Button>
        <Button onClick={() => setSaveOpen(true)} className="gap-2"><BookmarkPlus className="w-4 h-4" /> Save to Job</Button>
      </div>

      {/* Summary */}
      {rooms.length > 1 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-3">Total Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total Heat Loss</div>
              <div className="font-bold text-xl">{rooms.reduce((s,r)=>s+calcRoomHeatLoss(r,Ot),0).toLocaleString()} W</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Radiator Output Required</div>
              <div className="font-bold text-xl text-orange-600">
                {F > 0 ? rooms.reduce((s,r)=>s+Math.round(calcRoomHeatLoss(r,Ot)/F),0).toLocaleString() : "–"} W
              </div>
            </div>
          </div>
        </Card>
      )}

      <SaveToJobDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        content={formatResult(rooms, Ft, Rt, Ot)}
        toolName="Radiator Sizing"
      />
    </div>
  );
}
