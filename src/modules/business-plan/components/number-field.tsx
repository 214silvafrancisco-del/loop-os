"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** "eur" mostra €, "pct" converte fração ↔ percentagem, "int" sem decimais. */
  kind?: "eur" | "pct" | "int" | "num";
  suffix?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

/** Campo numérico compacto para as grelhas do Business Plan. */
export function NumberField({ label, value, onChange, kind = "eur", suffix, hint, disabled, className }: Props) {
  const display = kind === "pct" ? round(value * 100, 2) : kind === "int" ? Math.round(value) : round(value, 2);
  const unit = suffix ?? (kind === "eur" ? "€" : kind === "pct" ? "%" : "");
  return (
    <label className={cn("flex items-center justify-between gap-2 py-1 text-sm", className)}>
      <span className="min-w-0 truncate text-muted-foreground" title={hint ?? label}>
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={kind === "int" ? 1 : kind === "pct" ? 0.1 : 1}
          min={0}
          value={Number.isFinite(display) ? display : ""}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value === "" ? 0 : Number(e.target.value);
            if (!Number.isFinite(raw)) return;
            onChange(kind === "pct" ? raw / 100 : raw);
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-7 w-28 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            kind === "pct" && "w-20",
            kind === "int" && "w-16",
          )}
        />
        <span className="w-4 text-xs text-muted-foreground">{unit}</span>
      </span>
    </label>
  );
}

function round(v: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

/** Linha de valor calculado (só leitura), alinhada com os campos. */
export function ComputedRow({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 py-1 text-sm", strong && "font-semibold", className)}>
      <span className={cn("text-muted-foreground", strong && "text-foreground")}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
