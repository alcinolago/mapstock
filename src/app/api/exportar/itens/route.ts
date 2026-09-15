import { desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { listarItensComSaldo, type SituacaoItem } from "@/db/consultas";
import { niveis } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { paraCsv, respostaCsv } from "@/lib/csv";

const SITUACOES: SituacaoItem[] = ["ok", "falta", "abaixo_minimo", "nao_estocavel"];

const ROTULO_SITUACAO: Record<SituacaoItem, string> = {
  ok: "OK",
  falta: "Em falta",
  abaixo_minimo: "Abaixo do mínimo",
  nao_estocavel: "Não estocável",
};

/**
 * Exporta a listagem de itens como está na tela — os mesmos filtros da URL
 * valem aqui, então o que a pessoa filtrou é o que ela baixa.
 */
export async function GET(request: NextRequest) {
  await exigirSessao();

  const p = request.nextUrl.searchParams;
  const situacao = SITUACOES.find((s) => s === p.get("situacao"));

  const [lista, listaNiveis] = await Promise.all([
    listarItensComSaldo({
      busca: p.get("busca") ?? undefined,
      classificacaoId: p.get("classificacao") ?? undefined,
      nivel: p.get("nivel") ? Number(p.get("nivel")) : undefined,
      situacao,
      incluirInativos: p.get("inativos") === "1",
    }),
    db.select().from(niveis).orderBy(desc(niveis.num)),
  ]);

  const nomeNivel = new Map(listaNiveis.map((n) => [n.num, n.nome]));

  const csv = paraCsv(
    [
      "Código", "Descrição", "Classificação", "Nível", "Unidade",
      "Físico", "Reservado", "Disponível", "Estoque mínimo",
      "Custo unitário", "Valor em estoque", "Situação", "Localização", "Ativo",
    ],
    lista.map((i) => [
      i.codigo, i.descricao, i.classificacao,
      `${i.nivel} — ${nomeNivel.get(i.nivel) ?? ""}`, i.unidade,
      i.fisico, i.reservado, i.disponivel, i.estoqueMinimo,
      i.custoUnitario, i.valorEstoque,
      ROTULO_SITUACAO[i.situacao], i.localizacao, i.ativo,
    ]),
  );

  return respostaCsv(csv, "mapstock_itens");
}
