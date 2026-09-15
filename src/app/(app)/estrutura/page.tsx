import { asc } from "drizzle-orm";

import { Arvore, type NoEstrutura } from "@/components/estrutura/arvore";
import { FormularioVinculo } from "@/components/estrutura/formulario-vinculo";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CabecalhoCartao, Cartao } from "@/components/ui/cartao";
import { db } from "@/db";
import { listarItensComSaldo } from "@/db/consultas";
import { bom } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Estrutura" };

export default async function PaginaEstrutura() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const [lista, vinculos] = await Promise.all([
    listarItensComSaldo(),
    db.select().from(bom).orderBy(asc(bom.ordem)),
  ]);

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
        descricao="A árvore de componentes de cada equipamento — o que entra em quê, e em que quantidade."
      />

      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        {podeEditar ? (
          <FormularioVinculo itens={selecionaveis} />
        ) : (
          <p className="rounded-xl border border-borda bg-superficie px-4 py-6 text-sm text-texto-fraco">
            Seu perfil é somente leitura.
          </p>
        )}

        <Cartao className="overflow-hidden">
          <CabecalhoCartao
            titulo="Árvore de componentes"
            descricao={`${vinculos.length} ${vinculos.length === 1 ? "vínculo" : "vínculos"}`}
          />
          <Arvore raizes={raizes} podeEditar={podeEditar} />
        </Cartao>
      </div>
    </div>
  );
}
