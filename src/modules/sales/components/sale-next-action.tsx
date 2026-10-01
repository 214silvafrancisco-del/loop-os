"use client";

import { NextActionControl } from "@/core/ui/next-action-control";
import { completeLeadNextAction, completeSaleNextAction, updateLeadNextAction, updateSaleNextAction } from "../actions";

export function SaleNextAction({ saleId, action, date, compact, className }: { saleId: string; action: string | null; date: string | null; compact?: boolean; className?: string }) {
  return (
    <NextActionControl
      action={action}
      date={date}
      compact={compact}
      className={className}
      onSave={(input) => updateSaleNextAction(saleId, input)}
      onDone={() => completeSaleNextAction(saleId)}
    />
  );
}

export function LeadNextAction({ saleId, leadId, action, date, compact }: { saleId: string; leadId: string; action: string | null; date: string | null; compact?: boolean }) {
  return (
    <NextActionControl
      action={action}
      date={date}
      compact={compact}
      onSave={(input) => updateLeadNextAction(saleId, leadId, input)}
      onDone={() => completeLeadNextAction(saleId, leadId)}
    />
  );
}
