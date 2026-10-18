import { PageSkeleton } from "@/core/ui/page-skeleton";

/**
 * Estado de carregamento de qualquer página da app: aparece no instante em que
 * se toca num item do menu, enquanto o servidor prepara a página (as páginas
 * são dinâmicas e consultam a base de dados a cada pedido).
 */
export default function AppLoading() {
  return <PageSkeleton />;
}
