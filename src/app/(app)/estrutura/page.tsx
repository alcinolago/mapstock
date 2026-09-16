import { asc } from "drizzle-orm";

import { Arvore, type NoEstrutura } from "@/components/estrutura/arvore";
import { FormularioVinculo } from "@/components/estrutura/formulario-vinculo";
import { Montagens } from "@/components/estrutura/montagens";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CabecalhoCartao, Cartao } from "@/components/ui/cartao";
import { db } from "@/db";
import { listarItensComSaldo, listarMontagens } from "@/db/consultas";
import { bom } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Estrutura" };

export default async function PaginaEstrutura() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const [lista, vinculos, montagens] = await Promise.all([
    listarItensComSaldo(),
    db.select().from(bom).orderBy(asc(bom.ordem)),
    listarMontagens(),
  ]);

  /* Quantas unidades de cada estrutura existem montadas hoje — o numero que
     aparece ao lado do no e da o sentido de "isto existe de verdade". */
  const montadasPorItem = new Map<string, number>();
  for (const m of montagens) {
    montadasPorItem.set(m.itemId, (montadasPorItem.get(m.itemId) ?? 0) + 1);
  }

  const porId = new Map(lista.map((i) => [i.id, i]));
  const filhosDe = new Map<string, typeof vinculos>();
  for (const v of vinculos) {
    filhosDe.set(v.paiId, [...(filhosDe.get(v.paiId) ?? []), v]);
  }
  const usadosComoFilho = new Set(vinculos.map((v) => v.filhoId));

  /* Trava contra ciclo vindo de dado antigo: sem ela, uma aresta circular
     deixada no banco derrubaria a pagina num laco infinito de montagem. */
  function montar(
    itemId: string,
    vinculo: (typeof vinculos)[number] | null,
    caminho: Set<string>,
  ): NoEstrutura | null {
    const item = porId.get(itemId);
    if (!item || caminho.has(itemId)) return null;
    const novoCaminho = new Set(caminho).add(itemId);

    return {
      vinculoId: vinculo?.id ?? null,
      itemId: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      nivel: item.nivel,
      quantidade: vinculo?.quantidade ?? 0,
      obrigatorio: vinculo?.obrigatorio ?? true,
      localMontagem: vinculo?.localMontagem ?? null,
      disponivel: item.disponivel,
      montadas: montadasPorItem.get(item.id) ?? 0,
      filhos: (filhosDe.get(itemId) ?? [])
        .map((v) => montar(v.filhoId, v, novoCaminho))
        .filter((n): n is NoEstrutura => n !== null),
    };
  }

  /* Raizes: itens de Nivel 0, mais qualquer montagem com filhos que nao seja
     filha de ninguem — assim nenhum sub-conjunto solto some da tela. */
  const raizes = lista
    .filter((i) => !usadosComoFilho.has(i.id) && (i.nivel === 0 || filhosDe.has(i.id)))
    .map((i) => montar(i.id, null, new Set()))
    .filter((n): n is NoEstrutura => n !== null);

  const selecionaveis = lista.map((i) => ({
    id: i.id,
    codigo: i.codigo,
    descricao: i.descricao,
    unidade: i.unidade,
    disponivel: i.disponivel,
  }));

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Estrutura"
        descricao="A receita de cada equipamento e as unidades já montadas a partir dela."
      />

      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        {podeEditar ? (
          <FormularioVinculo itens={selecionaveis} />
        ) : (
          <p className="rounded-xl border border-borda bg-superficie px-4 py-6 text-sm text-texto-fraco">
            Seu perfil é somente leitura.
          </p>
        )}

        <div className="space-y-5">
          <Cartao className="overflow-hidden">
            <CabecalhoCartao
              titulo="Árvore de componentes"
              descricao={`${vinculos.length} ${vinculos.length === 1 ? "vínculo" : "vínculos"} · a receita de cada equipamento`}
            />
            <Arvore raizes={raizes} podeEditar={podeEditar} />
          </Cartao>

          <Cartao className="overflow-hidden">
            <CabecalhoCartao
              titulo="Unidades montadas"
              descricao="O que já existe pronto, e onde cada unidade está"
            />
            <Montagens montagens={montagens} podeEditar={podeEditar} />
          </Cartao>
        </div>
      </div>
    </div>
  );
}
