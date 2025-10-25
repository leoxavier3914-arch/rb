import { addDays, formatISO, parseISO } from "date-fns";

const MAX_WINDOW_DAYS = 90;

const ensureDateInput = (value: string | Date): Date => {
  if (value instanceof Date) {
    return value;
  }

  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date: expected an ISO date string (yyyy-mm-dd)");
  }

  return parsed;
};

const normalizeToUtcStartOfDay = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export interface SalesWindow {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
}

export function buildSalesWindow(start?: string | Date, end?: string | Date): SalesWindow {
  if (!start) {
    throw new Error("start date is required");
  }

  const startDate = normalizeToUtcStartOfDay(ensureDateInput(start));
  const initialEnd = end ? ensureDateInput(end) : addDays(startDate, 1);
  let endDate = normalizeToUtcStartOfDay(initialEnd);

  if (endDate.getTime() <= startDate.getTime()) {
    endDate = addDays(startDate, 1);
  }

  const maxEnd = addDays(startDate, MAX_WINDOW_DAYS);
  if (endDate.getTime() > maxEnd.getTime()) {
    endDate = maxEnd;
  }

  return {
    start: startDate,
    end: endDate,
    startDate: formatISO(startDate, { representation: "date" }),
    endDate: formatISO(endDate, { representation: "date" }),
  };
}
