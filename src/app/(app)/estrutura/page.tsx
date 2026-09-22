import { asc, eq } from "drizzle-orm";

import { PainelMoldes, type MoldeNaTela } from "@/components/moldes/painel-moldes";
import type { NoMolde } from "@/components/moldes/arvore-molde";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import {
  fotosPrincipais,
  listarItensComSaldo,
  listarMoldes,
  nosDoMolde,
  type NoDoMolde,
} from "@/db/consultas";
import { divisoes } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Estrutura" };

/**
 * Monta a arvore a partir da lista plana, e ja soma o custo subindo: o custo
 * de uma divisao e o que esta abaixo dela, multiplicado pela quantidade que
 * ela aparece. E o "quanto vai custar montar" pedido, nivel a nivel.
 *
 * O custo e sempre das pecas. O kit nao tem preco proprio — o domo nao se
 * compra, entao nao existe preco de domo; existe a soma do que entra nele.
 */
function emArvore(plana: NoDoMolde[], paiId: string | null): NoMolde[] {
  return plana
    .filter((n) => n.paiId === paiId)
    .map((n) => {
      const filhos = emArvore(plana, n.id);
      const proprio = n.itemId ? n.custo * n.quantidade : 0;
      const dosFilhos = filhos.reduce((t, f) => t + f.custoTotal, 0);
      return {
        id: n.id,
        nome: n.nome,
        itemId: n.itemId,
        codigo: n.codigo,
        descricao: n.descricao,
        unidade: n.unidade,
        quantidade: n.quantidade,
        localMontagem: n.localMontagem,
        disponivel: n.disponivel,
        custoTotal: proprio + dosFilhos * n.quantidade,
        filhos,
      };
    });
}

export default async function PaginaEstrutura() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const [lista, listaDivisoes, itens] = await Promise.all([
    listarMoldes(),
    db.select().from(divisoes).where(eq(divisoes.ativo, true)).orderBy(asc(divisoes.ordem)),
    listarItensComSaldo(),
  ]);

  const comArvore: MoldeNaTela[] = await Promise.all(
    lista.map(async (m) => {
      const nos = emArvore(await nosDoMolde(m.id), null);
      return {
        id: m.id,
        nome: m.nome,
        descricao: m.descricao,
        ativo: m.ativo,
        montagens: m.montagens,
        itemId: m.itemId,
        codigo: m.codigo,
        itemDescricao: m.itemDescricao,
        unidade: m.unidade,
        emEstoque: m.emEstoque,
        custoTotal: nos.reduce((t, n) => t + n.custoTotal, 0),
        nos,
      };
    }),
  );

  const fotos = await fotosPrincipais(itens.map((i) => i.id));

  const selecionaveis = itens.map((i) => ({
    id: i.id,
    codigo: i.codigo,
    descricao: i.descricao,
    unidade: i.unidade,
    disponivel: i.disponivel,
    fotoId: fotos.get(i.id),
  }));

  /* Um item tem uma receita so: o que ja virou kit sai da lista de escolha. */
  const comEstrutura = new Set(lista.map((m) => m.itemId).filter(Boolean) as string[]);

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Estrutura"
        descricao="Em cima, o manual do equipamento completo. Embaixo, os itens que são montados a partir de outros — esses vão para a Montagem."
      />

      <PainelMoldes
        moldes={comArvore}
        divisoes={listaDivisoes.map((d) => ({ id: d.id, nome: d.nome }))}
        itens={selecionaveis}
        itensSemEstrutura={selecionaveis.filter((i) => !comEstrutura.has(i.id))}
        podeEditar={podeEditar}
      />
    </div>
  );
}
