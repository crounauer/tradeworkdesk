import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function parseDateInput(dateStr: string) {
  let normalized = dateStr.trim();

  // Some mobile browsers reject SQL-style timestamps with a space separator.
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }

  // Normalize timezone offsets like +0000 to +00:00 for better compatibility.
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  return new Date(normalized);
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "N/A";
  try {
    const date = parseDateInput(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric' 
    }).format(date);
  } catch (e) {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "N/A";
  try {
    const date = parseDateInput(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
}
