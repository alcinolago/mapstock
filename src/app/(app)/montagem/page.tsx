import {
  NovaMontagem,
  PainelMontagem,
  type MontagemNaTela,
} from "@/components/montagem/painel-montagem";
import type { NoMontagem } from "@/components/montagem/arvore-montagem";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { listarMoldes, listarMontagens, nosDaMontagem, type NoDaMontagem } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Montagem" };

/**
 * Quanto cada item a montagem inteira consome.
 *
 * A quantidade multiplica descendo: uma divisão que aparece duas vezes leva o
 * dobro de tudo que tem dentro. O mesmo item pode estar em duas divisões, e
 * aí o que vale é a soma — é contra ela que o saldo é comparado, e não contra
 * a quantidade escrita numa linha só.
 */
function porItem(plana: NoDaMontagem[]): Map<string, number> {
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

function emArvore(
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

export default async function PaginaMontagem() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const [lista, moldes] = await Promise.all([listarMontagens(), listarMoldes()]);

  const comArvore: MontagemNaTela[] = await Promise.all(
    lista.map(async (m) => {
      const plana = await nosDaMontagem(m.id);
      const necessario = porItem(plana);

      /* O saldo de cada peca ja veio na consulta da arvore; falta so compara
         com o total que esta montagem consome. */
      const saldo = new Map(plana.filter((n) => n.itemId).map((n) => [n.itemId!, n.disponivel]));
      const faltando = [...necessario.entries()].filter(
        ([itemId, q]) => (saldo.get(itemId) ?? 0) < q,
      ).length;

      return {
        id: m.id,
        numero: m.numero,
        nome: m.nome,
        item: `${m.codigo} — ${m.itemDescricao}`,
        status: m.status,
        local: m.local,
        observacoes: m.observacoes,
        iniciadaEm: m.iniciadaEm,
        montadaEm: m.montadaEm,
        montadaPor: m.montadaPor,
        faltando,
        nos: emArvore(plana, null, necessario),
      };
    }),
  );

  const abertas = comArvore.filter((m) => m.status === "em_montagem").length;

  /* So kit se monta: o manual do equipamento completo nao produz item nenhum
     e nao aparece aqui. */
  const kits = moldes
    .filter((m) => m.itemId && m.ativo && m.nos > 0)
    .map((m) => ({ id: m.id, nome: m.nome, item: `${m.codigo} — ${m.itemDescricao}` }));

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Montagem"
        descricao={
          abertas > 0
            ? `${abertas} ${abertas === 1 ? "unidade aberta" : "unidades abertas"}. Montar dá baixa nas peças e coloca a unidade pronta no estoque.`
            : "Cada montagem é uma unidade. Montar dá baixa nas peças e coloca a unidade pronta no estoque."
        }
        acao={podeEditar ? <NovaMontagem kits={kits} /> : undefined}
      />

      <PainelMontagem montagens={comArvore} podeEditar={podeEditar} />
    </div>
  );
}
