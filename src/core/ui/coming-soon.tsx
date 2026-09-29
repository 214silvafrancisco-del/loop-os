import { Card, CardContent } from "@/components/ui/card";

/** Placeholder usado enquanto um módulo ainda não foi construído. */
export function ComingSoon({ step, what }: { step: string; what: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-1 py-12 text-center">
        <p className="text-sm font-medium">{what}</p>
        <p className="text-xs text-muted-foreground">Chega no {step}.</p>
      </CardContent>
    </Card>
  );
}
