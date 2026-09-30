#!/usr/bin/env bash
# Bloqueia o acesso externo a portas publicadas pelo Docker (que ignoram o UFW).
# Portas em /etc/loop-os/blocked-ports (uma por linha). Tráfego entre contentores não é afetado.
set -e
IFACE=${IFACE:-eth0}   # interface pública (ip route show default)
PORTS=$(grep -Eo '^[0-9]+' /etc/loop-os/blocked-ports 2>/dev/null || true)
for T in iptables ip6tables; do
  $T -N LOOP-BLOCK 2>/dev/null || $T -F LOOP-BLOCK
  for p in $PORTS; do
    $T -A LOOP-BLOCK -i $IFACE -p tcp -m conntrack --ctorigdstport $p --ctdir ORIGINAL -j DROP
  done
  $T -C DOCKER-USER -j LOOP-BLOCK 2>/dev/null || $T -I DOCKER-USER 1 -j LOOP-BLOCK
done
echo "portas bloqueadas externamente: ${PORTS:-nenhuma}" | tr '\n' ' '; echo
