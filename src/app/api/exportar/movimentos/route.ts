import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { itens, movimentos, unidades, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { paraCsv, respostaCsv } from "@/lib/csv";
import { MOVIMENTOS } from "@/lib/labels";

/** Histórico completo de movimentação, para conferência e contabilidade. */
export async function GET() {
  await exigirSessao();

  const linhas = await db
    .select({
      criadoEm: movimentos.criadoEm,
      tipo: movimentos.tipo,
      codigo: itens.codigo,
      descricao: itens.descricao,
      unidade: unidades.sigla,
      quantidade: movimentos.quantidade,
      referencia: movimentos.referencia,
      observacao: movimentos.observacao,
      usuario: usuarios.nome,
    })
    .from(movimentos)
    .innerJoin(itens, eq(itens.id, movimentos.itemId))
    .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(usuarios, eq(usuarios.id, movimentos.usuarioId))
    .orderBy(desc(movimentos.criadoEm));

  const csv = paraCsv(
    ["Data", "Tipo", "Código", "Descrição", "Quantidade", "Unidade", "Referência", "Observação", "Responsável"],
    linhas.map((m) => [
      m.criadoEm, MOVIMENTOS[m.tipo], m.codigo, m.descricao,
      m.quantidade, m.unidade, m.referencia, m.observacao, m.usuario,
    ]),
  );

  return respostaCsv(csv, "mapstock_movimentacoes");
}
