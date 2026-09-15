"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  classificacoes,
  itemFornecedores,
  itens,
  itensParametros3d,
  movimentos,
  regrasClassificacao,
} from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { codigoBase, codigoDisponivel } from "@/lib/codigo";
import { ORIGENS_3D } from "@/lib/labels";

/* ------------------------------------------------------------------------ */

const numeroTexto = z
  .string()
  .trim()
  .transform((v) => (v === "" ? 0 : Number(v.replace(",", "."))))
  .refine((v) => Number.isFinite(v) && v >= 0, "Informe um número válido");

const fornecedorVinculado = z.object({
  fornecedorId: z.uuid(),
  skuFornecedor: z.string().trim().optional(),
  linkItem: z.string().trim().optional(),
  preco: z.number().nonnegative().default(0),
  prazoValor: z.number().nonnegative().default(0),
  prazoUnidade: z.enum(["horas", "dias"]).default("dias"),
  qtdMinima: z.number().nonnegative().default(0),
  observacoes: z.string().trim().optional(),
  principal: z.boolean().default(false),
});

const parametros3d = z.object({
  material: z.string().trim().optional(),
  tempBico: z.string().trim().optional(),
  tempMesa: z.string().trim().optional(),
  preenchimento: z.string().trim().optional(),
  alturaCamada: z.string().trim().optional(),
  diametroBico: z.string().trim().optional(),
  pesoEstimado: z.string().trim().optional(),
  tempoEstimado: z.string().trim().optional(),
});

const esquemaItem = z.object({
  id: z.uuid().optional(),
  codigo: z
    .string()
    .trim()
    .min(1, "Informe o código")
    .max(60, "Código muito longo")
    .transform((v) => v.toUpperCase()),
  descricao: z.string().trim().min(1, "Informe a descrição"),
  classificacaoId: z.uuid("Escolha a classificação"),
  unidadeId: z.uuid("Escolha a unidade"),
  nivel: z.coerce.number().int().min(0),
  aquisicao: z
    .enum(["compra_nacional", "compra_importada", "fabricacao_interna", "sob_encomenda"])
    .nullable()
    .optional(),
  origemFabricacao: z
    .enum([
      "interna_impressao_3d",
      "interna_usinagem",
      "interna_montagem",
      "terceiro_impressao_3d",
      "terceiro_usinagem",
      "terceiro_corte_dobra",
      "compra_pronta_nacional",
      "compra_importada",
    ])
    .nullable()
    .optional(),
  linkCompra: z.string().trim().optional(),
  prazoValor: numeroTexto,
  prazoUnidade: z.enum(["horas", "dias"]),
  custoUnitario: numeroTexto,
  estoqueMinimo: numeroTexto,
  localizacao: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
  fichaTecnica: z.string().trim().optional(),
  ativo: z.coerce.boolean(),
  fornecedores: z.array(fornecedorVinculado).default([]),
  parametros3d: parametros3d.nullable().default(null),
  /* So vale na criacao, espelhando o "Tipo da quantidade inicial" do desktop. */
  quantidadeInicial: numeroTexto.optional(),
  tipoQuantidadeInicial: z
    .enum(["nenhum", "entrada_compra", "entrada_fabricacao", "ajuste_positivo"])
    .default("nenhum"),
});

export type EstadoItem = { erro?: string; campo?: string; ok?: boolean; id?: string };

/* ------------------------------------------------------------------------ */

/** Sugere um codigo livre a partir da descricao e da classificacao. */
export async function sugerirCodigo(
  descricao: string,
  classificacaoId: string,
): Promise<string | null> {
  if (!descricao.trim() || !classificacaoId) return null;

  const [classificacao] = await db
    .select({ prefixo: classificacoes.prefixoCodigo })
    .from(classificacoes)
    .where(eq(classificacoes.id, classificacaoId));
  if (!classificacao) return null;

  const usados = await db.select({ codigo: itens.codigo }).from(itens);
  return codigoDisponivel(
    codigoBase(descricao, classificacao.prefixo),
    new Set(usados.map((u) => u.codigo)),
  );
}

export async function salvarItem(
  _estado: EstadoItem,
  formulario: FormData,
): Promise<EstadoItem> {
  const sessao = await exigirEdicao();

  const bruto = {
    ...Object.fromEntries(formulario),
    ativo: formulario.get("ativo") === "on" || formulario.get("ativo") === "true",
    aquisicao: formulario.get("aquisicao") || null,
    origemFabricacao: formulario.get("origemFabricacao") || null,
    fornecedores: JSON.parse((formulario.get("fornecedores") as string) || "[]"),
    parametros3d: JSON.parse((formulario.get("parametros3d") as string) || "null"),
  };

  const dados = esquemaItem.safeParse(bruto);
  if (!dados.success) {
    const problema = dados.error.issues[0];
    return { erro: problema?.message ?? "Dados inválidos", campo: String(problema?.path[0]) };
  }

  const d = dados.data;

  /* Parametros 3D so fazem sentido para itens impressos. Guardar o bloco em
     um item usinado deixaria lixo que reaparece se a origem mudar de volta. */
  const guarda3d =
    d.origemFabricacao && ORIGENS_3D.includes(d.origemFabricacao) ? d.parametros3d : null;

  const campos = {
    codigo: d.codigo,
    descricao: d.descricao,
    classificacaoId: d.classificacaoId,
    unidadeId: d.unidadeId,
    nivel: d.nivel,
    aquisicao: d.aquisicao ?? null,
    origemFabricacao: d.origemFabricacao ?? null,
    linkCompra: d.linkCompra || null,
    prazoValor: d.prazoValor,
    prazoUnidade: d.prazoUnidade,
    custoUnitario: d.custoUnitario,
    estoqueMinimo: d.estoqueMinimo,
    localizacao: d.localizacao || null,
    observacoes: d.observacoes || null,
    fichaTecnica: d.fichaTecnica || null,
    ativo: d.ativo,
  };

  try {
    let itemId: string;

    if (d.id) {
      const [antes] = await db.select().from(itens).where(eq(itens.id, d.id));
      if (!antes) return { erro: "Item não encontrado." };

      const [atualizado] = await db
        .update(itens)
        .set({ ...campos, atualizadoEm: new Date(), atualizadoPor: sessao.id })
        .where(eq(itens.id, d.id))
        .returning();

      itemId = atualizado.id;
      await registrar({
        usuarioId: sessao.id,
        tabela: "itens",
        registroId: itemId,
        acao: "atualizar",
        antes,
        depois: atualizado,
      });
    } else {
      const [criado] = await db
        .insert(itens)
        .values({ ...campos, criadoPor: sessao.id, atualizadoPor: sessao.id })
        .returning();

      itemId = criado.id;
      await registrar({
        usuarioId: sessao.id,
        tabela: "itens",
        registroId: itemId,
        acao: "criar",
        depois: criado,
      });

      /* Quantidade inicial vira um movimento de verdade, para o saldo
         continuar sendo sempre a soma do historico. */
      if (d.tipoQuantidadeInicial !== "nenhum" && (d.quantidadeInicial ?? 0) > 0) {
        await db.insert(movimentos).values({
          itemId,
          tipo: d.tipoQuantidadeInicial,
          quantidade: d.quantidadeInicial!,
          referencia: "Cadastro inicial",
          usuarioId: sessao.id,
          observacao: "Quantidade informada no cadastro do item",
        });
      }
    }

    /* Vinculos e parametros: apaga e regrava. Sao poucas linhas por item e
       assim o estado no banco fica identico ao que o formulario mostra. */
    await db.delete(itemFornecedores).where(eq(itemFornecedores.itemId, itemId));
    if (d.fornecedores.length > 0) {
      await db.insert(itemFornecedores).values(
        d.fornecedores.map((f, ordem) => ({
          itemId,
          fornecedorId: f.fornecedorId,
          skuFornecedor: f.skuFornecedor || null,
          linkItem: f.linkItem || null,
          preco: f.preco,
          prazoValor: f.prazoValor,
          prazoUnidade: f.prazoUnidade,
          qtdMinima: f.qtdMinima,
          observacoes: f.observacoes || null,
          principal: f.principal,
          ordem,
        })),
      );
    }

    await db.delete(itensParametros3d).where(eq(itensParametros3d.itemId, itemId));
    if (guarda3d && Object.values(guarda3d).some(Boolean)) {
      await db.insert(itensParametros3d).values({ itemId, ...guarda3d });
    }

    revalidatePath("/itens");
    revalidatePath("/");
    return { ok: true, id: itemId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("itens_codigo_unique") || msg.includes("duplicate key")) {
      return { erro: `O código ${d.codigo} já está em uso por outro item.`, campo: "codigo" };
    }
    console.error(e);
    return { erro: "Não foi possível salvar o item. Tente de novo." };
  }
}

export async function alternarAtivoItem(id: string, ativo: boolean) {
  const sessao = await exigirEdicao();
  await db
    .update(itens)
    .set({ ativo, atualizadoEm: new Date(), atualizadoPor: sessao.id })
    .where(eq(itens.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "itens",
    registroId: id,
    acao: "atualizar",
    depois: { ativo },
  });
  revalidatePath("/itens");
}

/**
 * Exclusao definitiva. O desktop bloqueava excluir itens de Nivel 0; aqui a
 * regra e mais util: bloqueia qualquer item que tenha historico de estoque,
 * porque apagar movimento e apagar contabilidade. Nesse caso, desative.
 */
export async function excluirItem(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(itens).where(eq(itens.id, id));
  if (!antes) return { erro: "Item não encontrado." };

  const historico = await db
    .select({ id: movimentos.id })
    .from(movimentos)
    .where(eq(movimentos.itemId, id))
    .limit(1);

  if (historico.length > 0) {
    return {
      erro:
        "Este item já tem movimentações de estoque e não pode ser excluído. " +
        "Desative-o para tirá-lo das listas sem perder o histórico.",
    };
  }

  await db.delete(itens).where(eq(itens.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "itens",
    registroId: id,
    acao: "excluir",
    antes,
  });
  revalidatePath("/itens");
  return {};
}

/** Regras de classificacao automatica, para o formulario resolver no cliente. */
export async function carregarRegras() {
  return db
    .select({
      classificacaoId: regrasClassificacao.classificacaoId,
      palavraChave: regrasClassificacao.palavraChave,
    })
    .from(regrasClassificacao)
    .orderBy(regrasClassificacao.ordem);
}

export async function itensPorId(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(itens).where(inArray(itens.id, ids));
}
