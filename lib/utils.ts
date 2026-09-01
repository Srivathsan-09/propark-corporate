import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(dateString?: string | Date): string {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getInitials(name?: string): string {
  if (!name) return "PP";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    if (!dateStr || !timeStr) return null;
    const dateParts = dateStr.trim().split("-").map(Number);
    if (dateParts.length < 3) return null;
    const [year, month, day] = dateParts;
    if (!year || !month || !day) return null;

    let hours = 0;
    let minutes = 0;

    const cleanTime = timeStr.trim().toUpperCase();
    const isPM = cleanTime.includes("PM");
    const isAM = cleanTime.includes("AM");
    const timeDigits = cleanTime.replace(/(AM|PM)/g, "").trim();

    const parts = timeDigits.split(":");
    if (parts.length >= 1) hours = parseInt(parts[0], 10) || 0;
    if (parts.length >= 2) minutes = parseInt(parts[1], 10) || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  } catch (e) {
    return null;
  }
}

export function validateRideDepartureDateTime(
  dateStr: string,
  timeStr: string
): { isValid: boolean; error?: string } {
  if (!dateStr) return { isValid: false, error: "Please select a departure date." };
  if (!timeStr) return { isValid: false, error: "Please select a departure time." };

  const parsed = parseDateTime(dateStr, timeStr);
  if (!parsed) return { isValid: false, error: "Invalid departure date or time format." };

  const now = new Date();
  const graceNow = new Date(now.getTime() - 5 * 60 * 1000);

  if (parsed < graceNow) {
    return {
      isValid: false,
      error: `Cannot schedule a ride in the past (${dateStr} at ${timeStr}). Please select a future date and time.`,
    };
  }

  const maxAllowedDate = new Date();
  maxAllowedDate.setHours(0, 0, 0, 0);
  maxAllowedDate.setDate(maxAllowedDate.getDate() + 2); // Max 2 days in advance
  maxAllowedDate.setHours(23, 59, 59, 999);

  if (parsed > maxAllowedDate) {
    return {
      isValid: false,
      error: "Rides can only be scheduled up to 2 days in advance (Today, Tomorrow, or Day After Tomorrow).",
    };
  }

  return { isValid: true };
}
