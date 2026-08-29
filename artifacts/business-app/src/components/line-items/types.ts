export type PartStatus = "fitted" | "to_order";

export interface PartLine {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  serialNumber?: string | null;
  status: PartStatus;
  catalogueItemId?: string | null;
}

export interface ServiceLine {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  catalogueItemId?: string | null;
}

export interface TimeLine {
  key: string;
  arrival: string | null;
  departure: string | null;
  notes?: string | null;
  hourlyRate: number | null;
  calloutFee: number | null;
  calloutRateId?: string | null;
  createdByName?: string | null;
  canModify?: boolean;
  /** Set instead of arrival/departure for estimated (not-yet-worked) labour. */
  estimatedHours?: number | null;
  /** Shown in place of the date when there is no arrival time. */
  label?: string;
}

export interface CalloutRateOption {
  id: string;
  name: string;
  amount: number;
  hourly_rate: number | null;
  is_default?: boolean;
}

export type MoneyFormatter = (amount: number) => string;

export const defaultMoneyFormatter: MoneyFormatter = (amount) =>
  `£${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;

export function formatTotalTime(totalMinutes: number): string {
  const mins = Math.round(totalMinutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
