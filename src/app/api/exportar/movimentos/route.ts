import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { recorteDoMes } from "@/db/consultas";
import { itens, movimentos, unidades, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { paraCsv, respostaCsv } from "@/lib/csv";
import { MOVIMENTOS } from "@/lib/labels";
import { mesValido } from "@/lib/periodo";

/**
 * Histórico de movimentação, para conferência e contabilidade.
 *
 * Aceita o mesmo `mes` da tela para o arquivo bater com o que estava na
 * frente de quem clicou — planilha de fechamento nasce de um mês só.
 */
export async function GET(requisicao: Request) {
  await exigirSessao();

  const mes = mesValido(
    new URL(requisicao.url).searchParams.get("mes") ?? undefined,
  );

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
    .where(recorteDoMes(movimentos.criadoEm, mes))
    .orderBy(desc(movimentos.criadoEm));

  const csv = paraCsv(
    ["Data", "Tipo", "Código", "Descrição", "Quantidade", "Unidade", "Referência", "Observação", "Responsável"],
    linhas.map((m) => [
      m.criadoEm, MOVIMENTOS[m.tipo], m.codigo, m.descricao,
      m.quantidade, m.unidade, m.referencia, m.observacao, m.usuario,
    ]),
  );

  return respostaCsv(csv, mes ? `mapstock_movimentacoes_${mes}` : "mapstock_movimentacoes");
}
