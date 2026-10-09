"use client";

import { Filter } from "@oc/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GroupByOption {
  value: string;
  label: string;
}

interface GroupBySelectProps {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  options: GroupByOption[];
  placeholder?: string;
  width?: string;
}

export function GroupBySelect({
  value,
  onValueChange,
  options,
  placeholder = "No grouping",
  width = "w-36",
}: GroupBySelectProps) {
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => onValueChange(v === "none" ? undefined : v)}
    >
      <SelectTrigger className={`h-8 ${width}`}>
        <Filter className="size-3.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
