import type { ComponentType } from "react";
import { PropostaAquisicao, type TemplateProps } from "./proposta-aquisicao";

/**
 * Registo de layouts. Um template novo = um componente React-PDF novo aqui
 * e uma linha em `proposal_templates` com o `layout_key` correspondente.
 */
export const PDF_LAYOUTS: Record<string, ComponentType<TemplateProps>> = {
  "proposta-aquisicao": PropostaAquisicao,
};

export function getLayout(layoutKey: string): ComponentType<TemplateProps> {
  const layout = PDF_LAYOUTS[layoutKey];
  if (!layout) throw new Error(`Layout de proposta desconhecido: ${layoutKey}`);
  return layout;
}
