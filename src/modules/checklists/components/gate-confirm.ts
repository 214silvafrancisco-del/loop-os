import type { GateMissing } from "../gate-rules";

/** Aviso de porta (itens "warn"): pede confirmação e devolve true para continuar. */
export function confirmMissing(missing: GateMissing[], action = "continuar"): boolean {
  if (missing.length === 0) return true;
  const lines = missing.map((m) => `• ${m.label}${m.isRequired ? " (obrigatório)" : ""}`).join("\n");
  return window.confirm(`Ainda falta no processo:\n${lines}\n\nQueres ${action} mesmo assim?`);
}
