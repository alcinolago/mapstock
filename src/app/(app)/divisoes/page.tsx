import { asc, sql } from "drizzle-orm";

import { NovaDivisao, PainelDivisoes, type Divisao } from "@/components/divisoes/painel-divisoes";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import { db } from "@/db";
import { divisoes } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Divisões" };

export default async function PaginaDivisoes() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const lista = await db
    .select({
      id: divisoes.id,
      nome: divisoes.nome,
      ativo: divisoes.ativo,
      usos: sql<number>`(select count(*)::int from molde_nos n where n.divisao_id = ${sql.raw('"divisoes"."id"')})`,
    })
    .from(divisoes)
    .orderBy(asc(divisoes.ordem), asc(divisoes.nome));

  const dados: Divisao[] = lista;

  return (
    <>
      <CabecalhoPagina
        titulo="Divisões"
        descricao="As partes em que um equipamento se divide — Domo, Estrutura, Fiação, Fixação."
      />

      <Cartao className="overflow-hidden">
        <CabecalhoCartao
          titulo="Vocabulário da montagem"
          descricao="O mesmo nome serve a qualquer molde. Divisão não é item e nunca entra no estoque."
        />
        {podeEditar && (
          <CorpoCartao className="border-b border-borda">
            <NovaDivisao />
          </CorpoCartao>
        )}
        <PainelDivisoes divisoes={dados} podeEditar={podeEditar} />
      </Cartao>
    </>
  );
}
