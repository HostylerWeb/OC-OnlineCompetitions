"use client";

import { cn, formatDateIso, parseIsoDate } from "@oc/utils";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  /** Disables selection of dates before the current moment. Defaults to true. */
  disablePast?: boolean;
  /** Allows selecting a date in previous years (used for backdated entries). Defaults to false. */
  allowPastYears?: boolean;
}

function parseDateTimeValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function formatDateTimeValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function getTimePart(value: string): string {
  if (!value?.includes("T")) return "12:00";
  return value.split("T")[1]?.slice(0, 5) || "12:00";
}

export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "Pick date and time",
  className,
  disabled,
  error,
  disablePast = true,
  allowPastYears = false,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDateTimeValue(value), [value]);
  const timeValue = getTimePart(value);

  const displayLabel = selectedDate
    ? format(selectedDate, "EEE, d MMM yyyy 'at' HH:mm")
    : placeholder;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function applyDateTime(date: Date, time: string) {
    const [hours, minutes] = time.split(":");
    const next = new Date(date);
    next.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
    onChange(formatDateTimeValue(next));
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      onChange("");
      return;
    }
    applyDateTime(date, timeValue);
  }

  function handleTimeChange(nextTime: string) {
    const base = selectedDate ?? new Date();
    applyDateTime(base, nextTime);
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
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
              error && "border-destructive focus:border-destructive"
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col gap-3 p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              captionLayout="dropdown"
              defaultMonth={selectedDate}
              startMonth={
                new Date(
                  allowPastYears ? new Date().getFullYear() - 1 : new Date().getFullYear(),
                  0
                )
              }
              endMonth={new Date(new Date().getFullYear() + 5, 11)}
              disabled={disablePast ? { before: today } : undefined}
            />
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <ClockIcon />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="time"
                value={timeValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleTimeChange(e.target.value)
                }
                aria-label="Time"
              />
            </InputGroup>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export { formatDateIso, formatDateTimeValue, getTimePart, parseDateTimeValue, parseIsoDate };
