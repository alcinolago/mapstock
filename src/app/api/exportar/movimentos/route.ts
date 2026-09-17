import { and, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db";
import { recorteEntre } from "@/db/consultas";
import { itens, movimentos, unidades, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { paraCsv, respostaCsv } from "@/lib/csv";
import { MOVIMENTOS } from "@/lib/labels";
import { dataValida } from "@/lib/periodo";

/**
 * Histórico de movimentação, para conferência e contabilidade.
 *
 * Aceita os mesmos filtros da tela para o arquivo bater com o que estava na
 * frente de quem clicou — planilha de fechamento nasce de um recorte, não do
 * histórico inteiro. Sem limite aqui de propósito: a tela corta em 300 para
 * não pesar, mas exportação truncada calada estragaria a conferência.
 */
export async function GET(requisicao: Request) {
  await exigirSessao();

  const p = new URL(requisicao.url).searchParams;
  const de = dataValida(p.get("de") ?? undefined);
  const ate = dataValida(p.get("ate") ?? undefined);
  const item = p.get("item")?.trim() || undefined;
  const busca = p.get("busca")?.trim() || undefined;

  const condicoes = [
    recorteEntre(movimentos.criadoEm, de, ate),
    item ? eq(movimentos.itemId, item) : undefined,
    busca
      ? or(
          ilike(movimentos.referencia, `%${busca}%`),
          ilike(movimentos.observacao, `%${busca}%`),
          ilike(itens.codigo, `%${busca}%`),
          ilike(itens.descricao, `%${busca}%`),
        )
      : undefined,
  ].filter(Boolean);

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
    .where(condicoes.length ? and(...condicoes) : undefined)
    .orderBy(desc(movimentos.criadoEm));

  const csv = paraCsv(
    ["Data", "Tipo", "Código", "Descrição", "Quantidade", "Unidade", "Referência", "Observação", "Responsável"],
    linhas.map((m) => [
      m.criadoEm, MOVIMENTOS[m.tipo], m.codigo, m.descricao,
      m.quantidade, m.unidade, m.referencia, m.observacao, m.usuario,
    ]),
  );

  /* O nome ja leva data e hora de quem baixou; aqui entra so o recorte, e
     sem repetir o dia quando o periodo e de um dia so. */
  const periodo =
    de && ate ? (de === ate ? de : `${de}_a_${ate}`) : de ? `desde_${de}` : ate ? `ate_${ate}` : "";
  return respostaCsv(csv, periodo ? `mapstock_movimentacoes_${periodo}` : "mapstock_movimentacoes");
}
