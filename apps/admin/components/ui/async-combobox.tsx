"use client";

import { Check, ChevronsUpDown } from "@oc/icons";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface AsyncComboboxOption {
  value: string;
  label: string;
}

export interface AsyncComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  queryKey: string;
  fetchOptions: (search: string) => Promise<AsyncComboboxOption[]>;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AsyncCombobox({
  value,
  onValueChange,
  queryKey,
  fetchOptions,
  placeholder = "Search...",
  emptyMessage = "No results found.",
  searchPlaceholder = "Search...",
  disabled,
  className,
}: AsyncComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: options = [] } = useQuery({
    queryKey: [queryKey, search],
    queryFn: () => fetchOptions(search),
    staleTime: 10_000,
    select: (data) => data ?? [],
  });

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const handleSelect = useCallback(
    (currentValue: string) => {
      onValueChange(currentValue === value ? "" : currentValue);
      setOpen(false);
      setSearch("");
    },
    [onValueChange, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="max-h-60 overflow-auto">
          {options.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-accent",
                    value === option.value && "bg-accent font-medium"
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
