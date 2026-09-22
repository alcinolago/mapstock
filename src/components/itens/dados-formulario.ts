import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aquisicoes,
  classificacoes,
  fornecedores,
  itemFornecedores,
  itemFotos,
  itens,
  itensParametros3d,
  locais,
  materiais3d,
  origensFabricacao,
  regrasClassificacao,
  unidades,
} from "@/db/schema";
import type { DadosItem } from "./formulario-item";

/** Tudo que o formulario de item precisa para montar seus seletores. */
export async function opcoesFormulario() {
  const [
    listaClassificacoes,
    listaUnidades,
    listaFornecedores,
    listaLocais,
    listaAquisicoes,
    listaOrigens,
    listaMateriais,
    regras,
  ] = await Promise.all([
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
      db
        .select({ id: fornecedores.id, nome: fornecedores.nome })
        .from(fornecedores)
        .where(eq(fornecedores.ativo, true))
        .orderBy(asc(fornecedores.nome)),
      db.select().from(locais).orderBy(asc(locais.nome)),
      /* As tres listas que eram enum. So as ativas: desativar em
         Configuracoes tira dos selects sem mexer no que ja foi cadastrado. */
      db
        .select({ id: aquisicoes.id, nome: aquisicoes.nome })
        .from(aquisicoes)
        .where(eq(aquisicoes.ativo, true))
        .orderBy(asc(aquisicoes.ordem)),
      db
        .select({
          id: origensFabricacao.id,
          nome: origensFabricacao.nome,
          abreParametros3d: origensFabricacao.abreParametros3d,
        })
        .from(origensFabricacao)
        .where(eq(origensFabricacao.ativo, true))
        .orderBy(asc(origensFabricacao.ordem)),
      db
        .select({ id: materiais3d.id, nome: materiais3d.nome })
        .from(materiais3d)
        .where(eq(materiais3d.ativo, true))
        .orderBy(asc(materiais3d.ordem)),
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
    fornecedores: listaFornecedores,
    locais: listaLocais,
    aquisicoes: listaAquisicoes,
    origens: listaOrigens,
    materiais3d: listaMateriais,
    regras,
  };
}

/** Carrega um item no formato que o formulario consome. */
export async function carregarItem(id: string): Promise<DadosItem | null> {
  const [item] = await db.select().from(itens).where(eq(itens.id, id));
  if (!item) return null;

  const [vinculos, [params], fotos] = await Promise.all([
    db
      .select()
      .from(itemFornecedores)
      .where(eq(itemFornecedores.itemId, id))
      .orderBy(asc(itemFornecedores.ordem)),
    db.select().from(itensParametros3d).where(eq(itensParametros3d.itemId, id)),
    /* So o id: trazer o bytea aqui carregaria as tres fotos inteiras em toda
       abertura do cadastro, para exibir miniaturas. */
    db
      .select({ id: itemFotos.id })
      .from(itemFotos)
      .where(eq(itemFotos.itemId, id))
      .orderBy(asc(itemFotos.ordem)),
  ]);

  return {
    id: item.id,
    codigo: item.codigo,
    descricao: item.descricao,
    classificacaoId: item.classificacaoId,
    unidadeId: item.unidadeId,
    aquisicaoId: item.aquisicaoId,
    origemFabricacaoId: item.origemFabricacaoId,
    estoqueMinimo: item.estoqueMinimo,
    localId: item.localId,
    observacoes: item.observacoes,
    fichaTecnica: item.fichaTecnica,
    ativo: item.ativo,
    fotos: fotos.map((f) => f.id),
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
          materialId: params.materialId ?? "",
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
