"use client";

import { Minus, Plus, Ticket } from "@oc/icons";
import { useMemo, useState } from "react";
import { GoldOutlineButton } from "@/components/buttons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function buildPresets(max: number): number[] {
  if (max <= 0) return [1];
  const candidates = [1, 5, 10, 25, 50, 100, max];
  const set = new Set<number>();
  for (const n of candidates) {
    if (n >= 1 && n <= max) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

function sliderFillPercent(quantity: number, max: number): number {
  if (max <= 1) return quantity >= 1 ? 100 : 0;
  return ((quantity - 1) / (max - 1)) * 100;
}

export type TicketQuantitySelectorProps = {
  quantity: number;
  maxQuantity: number;
  disabled?: boolean;
  onQuantityChange: (value: number) => void;
  title?: string;
  priceSlot?: React.ReactNode;
  hintSlot?: React.ReactNode;
  maxPresetLabel?: string;
};

export function TicketQuantitySelector({
  quantity,
  maxQuantity,
  disabled = false,
  onQuantityChange,
  title,
  priceSlot,
  hintSlot,
  maxPresetLabel,
}: TicketQuantitySelectorProps) {
  const presets = useMemo(() => buildPresets(maxQuantity), [maxQuantity]);
  const sliderMax = Math.max(1, maxQuantity);
  const fill = sliderFillPercent(quantity, sliderMax);
  const sliderDisabled = disabled || maxQuantity <= 0;
  const rangeDisabled = sliderDisabled || maxQuantity <= 1;
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const quantityInputValue = quantityDraft ?? String(quantity);

  const commitQuantityInput = () => {
    const parsed = Number.parseInt(quantityDraft ?? String(quantity), 10);
    onQuantityChange(Number.isFinite(parsed) ? parsed : 1);
    setQuantityDraft(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        {title ? (
          <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h4>
        ) : (
          <span className="sr-only">Ticket quantity</span>
        )}
        {priceSlot ? <div className="shrink-0 text-right">{priceSlot}</div> : null}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
        {presets.length > 1 ? (
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {presets.map((preset) => {
              const isMaxPreset = preset === maxQuantity && preset > 100;
              const label =
                isMaxPreset && maxPresetLabel ? maxPresetLabel : String(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={sliderDisabled || preset > maxQuantity}
                  onClick={() => onQuantityChange(preset)}
                  className={cn(
                    "ticket-preset-btn",
                    quantity === preset && "ticket-preset-btn-active",
                    isMaxPreset && maxPresetLabel && "min-w-10 px-2.5 text-xs",
                  )}
                  data-umami-event={`competition:preset-${preset}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="ticket-slider-wrap">
          <div className="ticket-badge" style={{ left: `${fill}%` }}>
            <span className="tabular-nums">{quantity}</span>
            <Ticket className="size-4 shrink-0 text-gold" aria-hidden />
          </div>
          <div className="ticket-slider-track">
            <div className="ticket-slider-fill" style={{ width: `${fill}%` }} />
            <input
              type="range"
              className="ticket-slider-input"
              min={1}
              max={sliderMax}
              value={Math.min(Math.max(1, quantity), sliderMax)}
              disabled={rangeDisabled}
              onChange={(e) => onQuantityChange(Number.parseInt(e.target.value, 10))}
              aria-label="Ticket quantity"
              data-umami-event="competition:ticket-slider"
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <GoldOutlineButton
            size="icon"
            type="button"
            onClick={() => onQuantityChange(quantity - 1)}
            disabled={quantity <= 1 || sliderDisabled}
            className="h-11 w-11 rounded-full active:scale-95 transition-all"
            data-umami-event="competition:quantity-decrement"
          >
            <Minus className="size-5" />
          </GoldOutlineButton>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQuantity > 0 ? maxQuantity : undefined}
            value={quantityInputValue}
            disabled={sliderDisabled}
            onFocus={() => setQuantityDraft(String(quantity))}
            onChange={(e) => setQuantityDraft(e.target.value)}
            onBlur={commitQuantityInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            aria-label="Ticket quantity"
            className="h-11 w-[4.5rem] text-center text-lg font-bold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            data-umami-event="competition:quantity-input"
          />
          <GoldOutlineButton
            size="icon"
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            disabled={sliderDisabled || quantity >= maxQuantity}
            className="h-11 w-11 rounded-full active:scale-95 transition-all"
            data-umami-event="competition:quantity-increment"
          >
            <Plus className="size-5" />
          </GoldOutlineButton>
        </div>
      </div>

      {hintSlot}
    </div>
  );
}
