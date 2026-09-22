"use server";

import { and, count, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  moldeNos,
  moldes,
  classificacoes,
  cotacaoItens,
  itemFornecedores,
  itemFotos,
  itens,
  itensParametros3d,
  montagemNos,
  montagens,
  movimentos,
  pedidoItens,
  regrasClassificacao,
} from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { ehDuplicado, ehVinculado } from "@/lib/erros";
import { codigoBase, codigoDisponivel } from "@/lib/codigo";
import { contagens, emTexto, type Dependencias } from "@/lib/exclusao";
import { MAX_BYTES_FOTO, MAX_FOTOS } from "@/lib/imagem";
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

/* Cada posicao e uma foto que ja esta no banco ou uma que veio agora no
   proprio envio, apontando para o indice dela em `fotoNova`. A ordem do array
   e a ordem que a pessoa deixou na tela. */
const fotoOrdenada = z.union([
  z.object({ id: z.uuid() }),
  z.object({ nova: z.number().int().nonnegative() }),
]);

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
  estoqueMinimo: numeroTexto,
  /* Vazio significa "sem lugar definido", nao um lugar chamado "". */
  localId: z.union([z.literal(""), z.uuid()]).optional(),
  observacoes: z.string().trim().optional(),
  fichaTecnica: z.string().trim().optional(),
  ativo: z.coerce.boolean(),
  fornecedores: z.array(fornecedorVinculado).default([]),
  fotos: z
    .array(fotoOrdenada)
    .max(MAX_FOTOS, `São no máximo ${MAX_FOTOS} fotos por item`)
    .default([]),
  parametros3d: parametros3d.nullable().default(null),
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
    fotos: JSON.parse((formulario.get("fotos") as string) || "[]"),
    parametros3d: JSON.parse((formulario.get("parametros3d") as string) || "null"),
  };

  const dados = esquemaItem.safeParse(bruto);
  if (!dados.success) {
    const problema = dados.error.issues[0];
    return { erro: problema?.message ?? "Dados inválidos", campo: String(problema?.path[0]) };
  }

  const d = dados.data;

  /* Foto e miniatura vem em dois campos paralelos, casados pelo indice: o
     navegador gera as duas de uma vez (src/lib/imagem.ts). */
  const enviadas = arquivosDe(formulario, "fotoNova");
  const miniaturas = arquivosDe(formulario, "miniaturaNova");

  const problemaFoto = conferirFotos(enviadas, miniaturas);
  if (problemaFoto) return { erro: problemaFoto, campo: "fotos" };

  /* Parametros 3D so fazem sentido para itens impressos. Guardar o bloco em
     um item usinado deixaria lixo que reaparece se a origem mudar de volta. */
  const guarda3d =
    d.origemFabricacao && ORIGENS_3D.includes(d.origemFabricacao) ? d.parametros3d : null;

  const campos = {
    codigo: d.codigo,
    descricao: d.descricao,
    classificacaoId: d.classificacaoId,
    unidadeId: d.unidadeId,
    aquisicao: d.aquisicao ?? null,
    origemFabricacao: d.origemFabricacao ?? null,
    estoqueMinimo: d.estoqueMinimo,
    localId: d.localId || null,
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

    await sincronizarFotos(itemId, d.fotos, enviadas, miniaturas, sessao.id);

    await db.delete(itensParametros3d).where(eq(itensParametros3d.itemId, itemId));
    if (guarda3d && Object.values(guarda3d).some(Boolean)) {
      await db.insert(itensParametros3d).values({ itemId, ...guarda3d });
    }

    revalidatePath("/itens");
    revalidatePath("/");
    return { ok: true, id: itemId };
  } catch (e) {
    if (ehDuplicado(e)) {
      return { erro: `O código ${d.codigo} já está em uso por outro item.`, campo: "codigo" };
    }
    console.error(e);
    return { erro: "Não foi possível salvar o item. Tente de novo." };
  }
}

/* ------------------------------------------------------------------ Fotos */

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

/**
 * Confere o que chegou antes de escrever qualquer coisa.
 *
 * O navegador ja compacta (src/lib/imagem.ts), entao o teto aqui e rede de
 * seguranca contra um envio que nao passou por aquela tela — e tambem o que
 * mantem o corpo da action longe do limite de 1 MB do Next.
 */
function arquivosDe(formulario: FormData, campo: string): File[] {
  return formulario.getAll(campo).filter((f): f is File => f instanceof File && f.size > 0);
}

function conferirFotos(arquivos: File[], miniaturas: File[]): string | null {
  if (arquivos.length > MAX_FOTOS) return `São no máximo ${MAX_FOTOS} fotos por item.`;
  if (miniaturas.length !== arquivos.length) {
    return "Envio de foto incompleto. Recarregue a tela e tente de novo.";
  }

  for (const arquivo of [...arquivos, ...miniaturas]) {
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      return "Foto em formato não aceito. Use JPG, PNG ou WebP.";
    }
    if (arquivo.size > MAX_BYTES_FOTO) {
      return "Uma das fotos ficou grande demais. Tente de novo com outra imagem.";
    }
  }

  return null;
}

/**
 * Deixa as fotos do item exatamente como a tela mostra.
 *
 * Diferente dos vinculos de fornecedor, aqui nao da para apagar e regravar: o
 * binario das fotos que ficaram nao volta do navegador no envio, so o id
 * delas. Entao apaga o que saiu, reordena o que ficou e insere o que chegou.
 */
async function sincronizarFotos(
  itemId: string,
  ordem: ({ id: string } | { nova: number })[],
  enviadas: File[],
  miniaturas: File[],
  usuarioId: string,
) {
  const mantidas = ordem.filter((f) => "id" in f).map((f) => f.id);

  if (mantidas.length === 0) {
    await db.delete(itemFotos).where(eq(itemFotos.itemId, itemId));
  } else {
    await db
      .delete(itemFotos)
      .where(and(eq(itemFotos.itemId, itemId), notInArray(itemFotos.id, mantidas)));
  }

  for (const [posicao, entrada] of ordem.entries()) {
    if ("id" in entrada) {
      await db
        .update(itemFotos)
        .set({ ordem: posicao })
        .where(and(eq(itemFotos.id, entrada.id), eq(itemFotos.itemId, itemId)));
      continue;
    }

    const arquivo = enviadas[entrada.nova];
    const miniatura = miniaturas[entrada.nova];
    if (!arquivo || !miniatura) continue;

    await db.insert(itemFotos).values({
      itemId,
      dados: Buffer.from(await arquivo.arrayBuffer()),
      miniatura: Buffer.from(await miniatura.arrayBuffer()),
      tipo: arquivo.type,
      ordem: posicao,
      criadoPor: usuarioId,
    });
  }
}

/* ------------------------------------------------------------------------ */

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
 * O que segura a exclusao de um item, e o que vai junto se ela acontecer.
 *
 * Bloqueia so o que e documento — cotacao, pedido, montagem e molde —,
 * porque ai o item aparece num papel que ja circulou. Movimentacao avulsa
 * (entrada, ajuste) nao bloqueia: sem item nao ha saldo a somar, e o que
 * aconteceu fica no log de auditoria.
 *
 * A trava antiga era "tem qualquer movimento"; na pratica nenhum item era
 * excluivel, porque o proprio cadastro ja criava um.
 */
export async function dependenciasItem(id: string): Promise<Dependencias> {
  await exigirEdicao();

  /* O item aparece nos dois lados da estrutura: como peca dentro de uma
     arvore, e como o produto de um kit. Os dois seguram a exclusao — apagar o
     item que um kit produz deixaria a montagem sem saber o que ela faz. */
  const [
    emCotacoes,
    emPedidos,
    comoPeca,
    comoProduto,
    naEstrutura,
    produzidoPor,
    comMovimentos,
    comFornecedores,
    comFotos,
  ] = await Promise.all([
    db.select({ n: count() }).from(cotacaoItens).where(eq(cotacaoItens.itemId, id)),
    db.select({ n: count() }).from(pedidoItens).where(eq(pedidoItens.itemId, id)),
    db.select({ n: count() }).from(montagemNos).where(eq(montagemNos.itemId, id)),
    db.select({ n: count() }).from(montagens).where(eq(montagens.itemId, id)),
    db.select({ n: count() }).from(moldeNos).where(eq(moldeNos.itemId, id)),
    db.select({ n: count() }).from(moldes).where(eq(moldes.itemId, id)),
    db.select({ n: count() }).from(movimentos).where(eq(movimentos.itemId, id)),
    db.select({ n: count() }).from(itemFornecedores).where(eq(itemFornecedores.itemId, id)),
    db.select({ n: count() }).from(itemFotos).where(eq(itemFotos.itemId, id)),
  ]);

  return {
    bloqueios: contagens([
      { quantidade: emCotacoes[0].n, singular: "cotação", plural: "cotações" },
      { quantidade: emPedidos[0].n, singular: "pedido de compra", plural: "pedidos de compra" },
      {
        quantidade: comoPeca[0].n + comoProduto[0].n,
        singular: "montagem",
        plural: "montagens",
      },
      {
        quantidade: naEstrutura[0].n + produzidoPor[0].n,
        singular: "lugar na estrutura",
        plural: "lugares na estrutura",
      },
    ]),
    junto: contagens([
      {
        quantidade: comMovimentos[0].n,
        singular: "movimentação de estoque",
        plural: "movimentações de estoque",
      },
      {
        quantidade: comFornecedores[0].n,
        singular: "fornecedor vinculado",
        plural: "fornecedores vinculados",
      },
      { quantidade: comFotos[0].n, singular: "foto", plural: "fotos" },
    ]),
  };
}

/** Exclusao definitiva, depois de conferir o que a tela ja mostrou. */
export async function excluirItem(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(itens).where(eq(itens.id, id));
  if (!antes) return { erro: "Item não encontrado." };

  const { bloqueios, junto } = await dependenciasItem(id);
  if (bloqueios.length > 0) {
    return {
      erro:
        `Este item aparece em ${emTexto(bloqueios)} e não pode ser excluído. ` +
        "Desative-o para tirá-lo das listas sem perder o histórico.",
    };
  }

  try {
    await db.delete(itens).where(eq(itens.id, id));
  } catch (e) {
    if (ehVinculado(e)) {
      return {
        erro: "Este item passou a ser usado em outro registro agora há pouco. Recarregue a tela.",
      };
    }
    console.error(e);
    return { erro: "Não foi possível excluir o item. Tente de novo." };
  }

  /* Guarda tambem o que foi junto: e a unica forma de reconstruir depois
     que as linhas em cascata sumiram. */
  await registrar({
    usuarioId: sessao.id,
    tabela: "itens",
    registroId: id,
    acao: "excluir",
    antes: { ...antes, apagadoJunto: junto },
  });
  revalidatePath("/itens");
  revalidatePath("/");
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
