/**
 * Mostra os números e o texto do resumo diário de notificações de cada
 * organização, sem enviar nada. Uso: pnpm digest:preview
 */

async function main() {
  const { db } = await import("../src/core/db/client");
  const { organizations } = await import("../src/core/db/schema");
  const { buildDigest } = await import("../src/modules/notifications/digest");
  const { formatDigest } = await import("../src/modules/notifications/digest-format");
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  for (const org of orgs) {
    const data = await buildDigest(org.id);
    console.log(`\n${org.name}`);
    console.log(data);
    const payload = formatDigest(data);
    console.log(payload ? `${payload.title}\n${payload.body}` : "(sem notificação hoje)");
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
