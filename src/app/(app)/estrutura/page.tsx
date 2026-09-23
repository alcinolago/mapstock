import { asc, eq } from "drizzle-orm";

import { PainelMoldes } from "@/components/moldes/painel-moldes";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import { fotosPrincipais, listarItensComSaldo } from "@/db/consultas";
import { divisoes } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { listarEstruturas } from "@/lib/estrutura";

export const metadata = { title: "Estrutura" };

export default async function PaginaEstrutura() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const [comArvore, listaDivisoes, itens] = await Promise.all([
    listarEstruturas(),
    db.select().from(divisoes).where(eq(divisoes.ativo, true)).orderBy(asc(divisoes.ordem)),
    listarItensComSaldo(),
  ]);

  const fotos = await fotosPrincipais(itens.map((i) => i.id));

  const selecionaveis = itens.map((i) => ({
    id: i.id,
    codigo: i.codigo,
    descricao: i.descricao,
    unidade: i.unidade,
    disponivel: i.disponivel,
    fotoId: fotos.get(i.id),
  }));

  /* Um item tem uma receita so: o que ja virou conjunto sai da lista de escolha. */
  const comEstrutura = new Set(comArvore.map((m) => m.itemId).filter(Boolean) as string[]);

  return (
    <>
      <CabecalhoPagina titulo="Estrutura" />

      <PainelMoldes
        moldes={comArvore}
        divisoes={listaDivisoes.map((d) => ({ id: d.id, nome: d.nome }))}
        itens={selecionaveis}
        itensSemEstrutura={selecionaveis.filter((i) => !comEstrutura.has(i.id))}
        podeEditar={podeEditar}
      />
    </>
  );
}
