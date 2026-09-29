import { z } from "zod";

export const CONTACT_ROLES = [
  "consultor",
  "proprietario",
  "fornecedor",
  "banco",
  "advogado",
  "arquiteto",
  "outro",
] as const;

export const CONTACT_ROLE_LABEL: Record<(typeof CONTACT_ROLES)[number], string> = {
  consultor: "Consultor",
  proprietario: "Proprietário",
  fornecedor: "Fornecedor",
  banco: "Banco",
  advogado: "Advogado",
  arquiteto: "Arquiteto",
  outro: "Outro",
};

export const CONTACT_KIND_LABEL = {
  person: "Pessoa",
  company: "Empresa",
} as const;

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/** Telefone em E.164. Números portugueses de 9 dígitos ganham +351. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (!digits.startsWith("+")) {
    if (/^\d{9}$/.test(digits)) digits = "+351" + digits;
    else if (/^351\d{9}$/.test(digits)) digits = "+" + digits;
    else return digits.length >= 6 ? digits : null;
  }
  return digits;
}

/** NIF português: 9 dígitos com dígito de controlo válido. */
export function isValidNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const d = nif.split("").map(Number);
  const sum = d.slice(0, 8).reduce((acc, n, i) => acc + n * (9 - i), 0);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === d[8];
}

export const contactInputSchema = z
  .object({
    kind: z.enum(["person", "company"]).default("person"),
    name: z.string().trim().min(2, "Nome demasiado curto."),
    roles: z.array(z.enum(CONTACT_ROLES)).min(1, "Escolhe pelo menos um papel."),
    companyName: optionalText,
    phone: optionalText,
    email: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.email("Email inválido.").nullable())
      .nullable()
      .optional(),
    nif: optionalText.transform((v) => (v ? v.replace(/\s/g, "") : v)),
    address: optionalText,
    iban: optionalText.transform((v) => (v ? v.replace(/\s/g, "").toUpperCase() : v)),
    notes: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.nif && !isValidNif(data.nif)) {
      ctx.addIssue({ code: "custom", path: ["nif"], message: "NIF inválido." });
    }
    if (data.roles.includes("fornecedor") && !data.nif) {
      ctx.addIssue({ code: "custom", path: ["nif"], message: "Fornecedores precisam de NIF." });
    }
  });

export type ContactInput = z.input<typeof contactInputSchema>;
export type ContactData = z.output<typeof contactInputSchema>;

/** Converte um FormData (checkboxes de papéis incluídas) no objeto de entrada. */
export function contactInputFromForm(formData: FormData): ContactInput {
  return {
    kind: (formData.get("kind") as "person" | "company") ?? "person",
    name: String(formData.get("name") ?? ""),
    roles: formData.getAll("roles").map(String) as ContactInput["roles"],
    companyName: String(formData.get("companyName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    nif: String(formData.get("nif") ?? ""),
    address: String(formData.get("address") ?? ""),
    iban: String(formData.get("iban") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}
