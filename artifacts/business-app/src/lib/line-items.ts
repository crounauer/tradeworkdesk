/**
 * Shared line-item helpers used by the job, quote and invoice pages so all three
 * present parts / services / time in exactly the same format.
 */

export interface LabourBreakdown {
  totalHours: number;
  calloutHours: number;
  calloutRate: number;
  calloutCost: number;
  billableHours: number;
  hourlyRate: number;
  billableCost: number;
  entryCost: number;
}

export interface LabourInput {
  arrival: string | Date | null | undefined;
  departure: string | Date | null | undefined;
  hourlyRate: number | null | undefined;
  calloutFee: number | null | undefined;
}

/** "2h 30m" / "45m" / "—" when the range is empty or inverted. */
export function calcDuration(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return formatDuration(ms / 3600000);
}

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const mins = Math.round(hours * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function hoursBetween(start: string | Date | null | undefined, end: string | Date | null | undefined): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, ms / 3600000);
}

/**
 * Billing model shared with the job page: the callout fee covers the first hour,
 * every hour after that is charged at the hourly rate. An entry with no departure
 * is still charged its callout fee.
 */
export function computeLabourBreakdown({ arrival, departure, hourlyRate, calloutFee }: LabourInput): LabourBreakdown {
  const callout = calloutFee != null && Number.isFinite(Number(calloutFee)) ? Number(calloutFee) : 0;
  const rate = hourlyRate != null && Number.isFinite(Number(hourlyRate)) ? Number(hourlyRate) : 0;

  if (!departure) {
    return {
      totalHours: 0,
      calloutHours: 0,
      calloutRate: callout,
      calloutCost: callout,
      billableHours: 0,
      hourlyRate: 0,
      billableCost: 0,
      entryCost: callout,
    };
  }

  const totalHours = hoursBetween(arrival, departure);
  const calloutHoursForEntry = callout > 0 ? 1 : 0;
  const calloutHours = Math.min(totalHours, calloutHoursForEntry);
  const billableHours = Math.max(0, totalHours - calloutHoursForEntry);
  const billableCost = billableHours > 0 && rate > 0 ? billableHours * rate : 0;

  return {
    totalHours,
    calloutHours,
    calloutRate: callout,
    calloutCost: callout,
    billableHours,
    hourlyRate: rate,
    billableCost,
    entryCost: callout + billableCost,
  };
}

export function lineTotal(quantity: number | string | null | undefined, unitPrice: number | string | null | undefined): number {
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

export function sectionSubtotal<T>(
  items: T[],
  getQuantity: (item: T) => number | string | null | undefined,
  getUnitPrice: (item: T) => number | string | null | undefined,
): number {
  return items.reduce((sum, item) => sum + lineTotal(getQuantity(item), getUnitPrice(item)), 0);
}

/** Value for an <input type="datetime-local">. */
export function toLocalDatetimeStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
