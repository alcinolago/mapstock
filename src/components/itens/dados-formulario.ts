import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  classificacoes,
  fornecedores,
  itemFornecedores,
  itens,
  itensParametros3d,
  niveis,
  regrasClassificacao,
  unidades,
} from "@/db/schema";
import type { DadosItem } from "./formulario-item";
import { PARAMS_3D_PADRAO } from "./parametros-3d";

/** Tudo que o formulario de item precisa para montar seus seletores. */
export async function opcoesFormulario() {
  const [listaClassificacoes, listaUnidades, listaNiveis, listaFornecedores, regras] =
    await Promise.all([
      db
        .select({ id: classificacoes.id, nome: classificacoes.nome, prefixoCodigo: classificacoes.prefixoCodigo })
        .from(classificacoes)
        .where(eq(classificacoes.ativo, true))
        .orderBy(asc(classificacoes.ordem)),
      db
        .select({ id: unidades.id, sigla: unidades.sigla, nome: unidades.nome })
        .from(unidades)
        .where(eq(unidades.ativo, true))
        .orderBy(asc(unidades.sigla)),
      db.select().from(niveis).orderBy(asc(niveis.num)),
      db
        .select({ id: fornecedores.id, nome: fornecedores.nome })
        .from(fornecedores)
        .where(eq(fornecedores.ativo, true))
        .orderBy(asc(fornecedores.nome)),
      db
        .select({
          classificacaoId: regrasClassificacao.classificacaoId,
          palavraChave: regrasClassificacao.palavraChave,
        })
        .from(regrasClassificacao)
        .orderBy(asc(regrasClassificacao.ordem)),
    ]);

  return {
    classificacoes: listaClassificacoes,
    unidades: listaUnidades,
    niveis: listaNiveis,
    fornecedores: listaFornecedores,
    regras,
  };
}

/** Carrega um item no formato que o formulario consome. */
export async function carregarItem(id: string): Promise<DadosItem | null> {
  const [item] = await db.select().from(itens).where(eq(itens.id, id));
  if (!item) return null;

  const [vinculos, [params]] = await Promise.all([
    db
      .select()
      .from(itemFornecedores)
      .where(eq(itemFornecedores.itemId, id))
      .orderBy(asc(itemFornecedores.ordem)),
    db.select().from(itensParametros3d).where(eq(itensParametros3d.itemId, id)),
  ]);

  return {
    id: item.id,
    codigo: item.codigo,
    descricao: item.descricao,
    classificacaoId: item.classificacaoId,
    unidadeId: item.unidadeId,
    nivel: item.nivel,
    aquisicao: item.aquisicao,
    origemFabricacao: item.origemFabricacao,
    estoqueMinimo: item.estoqueMinimo,
    localizacao: item.localizacao,
    observacoes: item.observacoes,
    fichaTecnica: item.fichaTecnica,
    ativo: item.ativo,
    vinculos: vinculos.map((v) => ({
      fornecedorId: v.fornecedorId,
      skuFornecedor: v.skuFornecedor ?? "",
      linkItem: v.linkItem ?? "",
      preco: String(v.preco),
      prazoValor: String(v.prazoValor),
      prazoUnidade: v.prazoUnidade,
      qtdMinima: String(v.qtdMinima),
      observacoes: v.observacoes ?? "",
      principal: v.principal,
    })),
    parametros3d: params
      ? {
          material: params.material ?? PARAMS_3D_PADRAO.material,
          tempBico: params.tempBico ?? "",
          tempMesa: params.tempMesa ?? "",
          preenchimento: params.preenchimento ?? "",
          alturaCamada: params.alturaCamada ?? "",
          diametroBico: params.diametroBico ?? "",
          pesoEstimado: params.pesoEstimado ?? "",
          tempoEstimado: params.tempoEstimado ?? "",
        }
      : null,
  };
}
