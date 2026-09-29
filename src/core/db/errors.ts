/**
 * O Drizzle embrulha os erros do Postgres (DrizzleQueryError → cause). Esta
 * função devolve a mensagem original, para reconhecer triggers e índices
 * únicos nas actions sem depender do formato do wrapper.
 */
export function dbErrorMessage(e: unknown): string {
  if (!e || typeof e !== "object") return String(e);
  const err = e as { message?: string; cause?: unknown; constraint_name?: string };
  const cause = err.cause as { message?: string; constraint_name?: string } | undefined;
  return [cause?.message, cause?.constraint_name, err.message, err.constraint_name].filter(Boolean).join(" | ");
}
