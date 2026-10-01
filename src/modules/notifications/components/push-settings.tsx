"use client";

import { Bell, BellOff, BellRing, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deletePushSubscription, savePushSubscription, sendDigestPreview, sendTestNotification } from "../actions";
import type { PushStatus } from "../queries";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Support = "checking" | "ok" | "unsupported" | "ios-not-installed";

/** Cartão "Notificações" nas Definições: ativar/desativar neste dispositivo e testar. */
export function PushSettings({ status }: { status: PushStatus }) {
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Deteção só no browser, depois da hidratação (evita diferenças servidor/cliente).
    const detect = () => {
      const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!ok) {
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
        setSupport(ios && !standalone ? "ios-not-installed" : "unsupported");
        return;
      }
      setSupport("ok");
      setPermission(Notification.permission);
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(Boolean(sub)))
        .catch(() => setSubscribed(false));
    };
    const id = window.setTimeout(detect, 0);
    return () => window.clearTimeout(id);
  }, []);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          setMessage("Sem permissão do browser não é possível ativar.");
          return;
        }
        if (!status.publicKey) {
          setMessage("O servidor ainda não tem as chaves de notificação.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(status.publicKey) }));
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setMessage("O browser não devolveu uma subscrição válida.");
          return;
        }
        const r = await savePushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, userAgent: navigator.userAgent.slice(0, 300) });
        if (!r.ok) {
          setMessage(r.error);
          return;
        }
        setSubscribed(true);
        setMessage("Notificações ativas neste dispositivo.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Não foi possível ativar.");
      }
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await deletePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
        setMessage("Notificações desativadas neste dispositivo.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Não foi possível desativar.");
      }
    });
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const r = await sendTestNotification();
      setMessage(r.ok ? `Enviada para ${r.sent} dispositivo${r.sent === 1 ? "" : "s"}.` : r.error);
    });
  }

  function preview() {
    setMessage(null);
    startTransition(async () => {
      const r = await sendDigestPreview();
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      setMessage(r.empty ? "Hoje não há ações nem faturas a vencer: o resumo não é enviado." : `Resumo de hoje enviado para ${r.sent} dispositivo${r.sent === 1 ? "" : "s"}.`);
    });
  }

  const Icon = subscribed ? BellRing : Bell;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">Notificações</h2>
          <p className="text-xs text-muted-foreground">
            Resumo diário das próximas ações e faturas a vencer, enviado para o telemóvel ou computador. Ativa-se dispositivo a dispositivo.
            {status.deviceCount > 0 ? ` Tens ${status.deviceCount} dispositivo${status.deviceCount === 1 ? "" : "s"} com notificações.` : ""}
          </p>

          {!status.configured ? (
            <p className="mt-2 text-xs text-warning">O servidor ainda não tem as chaves de notificação (VAPID). Ver docs/05.</p>
          ) : support === "ios-not-installed" ? (
            <p className="mt-2 text-xs text-muted-foreground">No iPhone as notificações só funcionam com a app instalada: Partilhar → «Adicionar ao ecrã principal» e abre a partir daí.</p>
          ) : support === "unsupported" ? (
            <p className="mt-2 text-xs text-muted-foreground">Este browser não suporta notificações push.</p>
          ) : permission === "denied" ? (
            <p className="mt-2 text-xs text-destructive">O browser bloqueou as notificações para este site. Desbloqueia nas definições do site e volta aqui.</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {support === "ok" && status.configured ? (
              subscribed ? (
                <>
                  <Button type="button" variant="outline" className="h-11 gap-1 md:h-9" onClick={disable} disabled={pending}>
                    <BellOff className="size-4" /> Desativar neste dispositivo
                  </Button>
                  <Button type="button" variant="outline" className="h-11 gap-1 md:h-9" onClick={test} disabled={pending}>
                    <Send className="size-4" /> Enviar teste
                  </Button>
                  <Button type="button" variant="ghost" className="h-11 gap-1 md:h-9" onClick={preview} disabled={pending}>
                    Ver resumo de hoje
                  </Button>
                </>
              ) : (
                <Button type="button" className="h-11 gap-1 md:h-9" onClick={enable} disabled={pending || permission === "denied" || subscribed === null}>
                  <Bell className="size-4" /> Ativar neste dispositivo
                </Button>
              )
            ) : null}
          </div>
          {message ? <p className="mt-2 text-xs text-muted-foreground" role="status">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
