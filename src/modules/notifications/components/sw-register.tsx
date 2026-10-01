"use client";

import { useEffect } from "react";

/**
 * Regista o service worker das notificações. Não pede permissão: isso só
 * acontece quando o utilizador ativa as notificações nas Definições.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[sw] registo falhou", e));
  }, []);
  return null;
}
