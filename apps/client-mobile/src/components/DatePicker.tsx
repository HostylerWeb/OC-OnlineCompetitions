"use client";

import {
  formatDateIso,
  getDefaultBirthDate,
  getLatestAllowedBirthDate,
  parseIsoDate,
} from "@oc/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { Matcher } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function buildDisabledMatcher({
  useExplicitRange,
  useAgeRange,
  minDate,
  maxDate,
  latestAllowedDate,
}: {
  useExplicitRange: boolean;
  useAgeRange: boolean;
  minDate?: Date;
  maxDate?: Date;
  latestAllowedDate?: Date;
}): Matcher | Matcher[] | undefined {
  const matchers: Matcher[] = [];
  if (useExplicitRange) {
    if (minDate) matchers.push({ before: minDate } as Matcher);
    if (maxDate) matchers.push({ after: maxDate } as Matcher);
    return matchers.length > 0 ? matchers : undefined;
  }
  if (useAgeRange && latestAllowedDate) {
    return { after: latestAllowedDate } as Matcher;
  }
  return undefined;
}

export interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Minimum age in years — dates after this cutoff are disabled. When set, used to restrict selection. */
  minAge?: number;
  /** When true (and minAge is set), opens the calendar on the latest allowed birth month. */
  defaultToMinAge?: boolean;
  /** Explicit minimum selectable date. Used when minAge is not set. */
  minDate?: Date;
  /** Explicit maximum selectable date. Used when minAge is not set. */
  maxDate?: Date;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  minAge,
  defaultToMinAge,
  minDate,
  maxDate,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: DatePickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);

  const useAgeRange = typeof minAge === "number";
  const useExplicitRange = !useAgeRange && Boolean(minDate || maxDate);
  const latestAllowedDate = useMemo(
    () => maxDate ?? (useAgeRange ? getLatestAllowedBirthDate(minAge as number) : undefined),
    [maxDate, useAgeRange, minAge]
  );
  const earliestAllowedDate = useMemo(
    () => minDate ?? new Date(new Date().getFullYear() - 100, 0),
    [minDate]
  );
  const defaultMonth = useMemo(() => {
    if (selectedDate) return selectedDate;
    if (minDate) return minDate;
    if (useAgeRange) {
      return defaultToMinAge ? getDefaultBirthDate(minAge as number) : latestAllowedDate;
    }
    return new Date();
  }, [selectedDate, minDate, useAgeRange, defaultToMinAge, minAge, latestAllowedDate]);

  const displayLabel = selectedDate ? format(selectedDate, "EEE, d MMM yyyy") : placeholder;

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onChange("");
      return;
    }
    onChange(formatDateIso(date));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          captionLayout="dropdown"
          defaultMonth={defaultMonth}
          startMonth={earliestAllowedDate}
          endMonth={latestAllowedDate ?? new Date(new Date().getFullYear() + 5, 11)}
          disabled={buildDisabledMatcher({
            useExplicitRange,
            useAgeRange,
            minDate,
            maxDate,
            latestAllowedDate,
          })}
        />
      </PopoverContent>
    </Popover>
  );
}
