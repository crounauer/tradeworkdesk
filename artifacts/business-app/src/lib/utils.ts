import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "N/A";
  try {
    return new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric' 
    }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "N/A";
  try {
    return new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
}
