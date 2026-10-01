import { NextResponse, type NextRequest } from "next/server";
import { sendDailyDigest } from "@/modules/notifications/digest";

/**
 * Resumo diário por notificação push. Chamado por um agendamento (Coolify
 * "Scheduled task" ou cron) com `Authorization: Bearer <CRON_SECRET>`.
 * Sem segredo configurado a rota fica fechada.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = await sendDailyDigest();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron] resumo diário falhou", e);
    return NextResponse.json({ ok: false, error: "Falha ao enviar o resumo." }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
