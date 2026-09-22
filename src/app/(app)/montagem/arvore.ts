import type { NoMontagem } from "@/components/montagem/arvore-montagem";
import type { NoDaMontagem } from "@/db/consultas";

/**
 * Quanto cada item a montagem inteira consome.
 *
 * A quantidade multiplica descendo: uma divisão que aparece duas vezes leva o
 * dobro de tudo que tem dentro. O mesmo item pode estar em duas divisões, e
 * aí o que vale é a soma — é contra ela que o saldo é comparado, e não contra
 * a quantidade escrita numa linha só.
 */
export function porItem(plana: NoDaMontagem[]): Map<string, number> {
  const filhosDe = new Map<string | null, NoDaMontagem[]>();
  for (const n of plana) filhosDe.set(n.paiId, [...(filhosDe.get(n.paiId) ?? []), n]);

  const total = new Map<string, number>();
  function descer(paiId: string | null, fator: number) {
    for (const no of filhosDe.get(paiId) ?? []) {
      const q = no.quantidade * fator;
      if (no.itemId) total.set(no.itemId, (total.get(no.itemId) ?? 0) + q);
      else descer(no.id, q);
    }
  }
  descer(null, 1);
  return total;
}

export function emArvore(
  plana: NoDaMontagem[],
  paiId: string | null,
  necessario: Map<string, number>,
): NoMontagem[] {
  return plana
    .filter((n) => n.paiId === paiId)
    .map((n) => ({
      id: n.id,
      nome: n.nome,
      itemId: n.itemId,
      codigo: n.codigo,
      descricao: n.descricao,
      unidade: n.unidade,
      quantidade: n.quantidade,
      necessario: n.itemId ? (necessario.get(n.itemId) ?? n.quantidade) : 0,
      localMontagem: n.localMontagem,
      disponivel: n.disponivel,
      filhos: emArvore(plana, n.id, necessario),
    }));
}
