import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export {
  formatDateIso,
  getDefaultBirthDate,
  getLatestAllowedBirthDate,
  parseIsoDate,
} from "@oc/utils";
