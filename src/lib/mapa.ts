/**
 * Link de rota a partir do endereço digitado.
 *
 * O endereço é texto livre porque nem todo fornecedor tem um: Mercado Livre e
 * AliExpress não têm para onde dirigir. Quem tem escreve de qualquer jeito, e
 * quem resolve o texto é o próprio Maps — não guardamos coordenada nem
 * validamos CEP aqui.
 *
 * A URL usa o formato universal do Google Maps (`api=1`): no celular o app
 * abre direto na rota, e no computador cai no site. `dir` em vez de `search`
 * porque o que se compartilha é "como chegar", não "onde fica".
 */
export function linkRota(endereco: string | null | undefined) {
  const limpo = endereco?.trim();
  if (!limpo) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(limpo)}`;
}
