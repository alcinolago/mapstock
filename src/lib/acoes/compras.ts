"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { itensJaPedidos, listarItensComSaldo } from "@/db/consultas";
import {
  cotacaoItens,
  cotacaoPrecos,
  cotacoes,
  itemFornecedores,
  itens,
  movimentos,
  pedidoItens,
  pedidosCompra,
} from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { explodirMolde } from "./moldes";

/** Numero sequencial por ano: COT-2026-0001, PC-2026-0007. */
async function proximoNumero(prefixo: "COT" | "PC"): Promise<string> {
  const ano = new Date().getFullYear();
  const inicio = `${prefixo}-${ano}-`;

  const tabela = prefixo === "COT" ? cotacoes : pedidosCompra;
  const [linha] = await db
    .select({ numero: tabela.numero })
    .from(tabela)
    .where(sql`${tabela.numero} like ${inicio + "%"}`)
    .orderBy(desc(tabela.numero))
    .limit(1);

  const ultimo = linha ? Number(linha.numero.slice(inicio.length)) : 0;
  return `${inicio}${String(ultimo + 1).padStart(4, "0")}`;
}

/* ------------------------------------------------------------- Cotação --- */

export type EstadoCotacao = { erro?: string; ok?: boolean; id?: string };

export async function criarCotacao(
  _estado: EstadoCotacao,
  formulario: FormData,
): Promise<EstadoCotacao> {
  const sessao = await exigirEdicao();

  const dados = z
    .object({
      titulo: z.string().trim().min(1, "Dê um nome para esta cotação"),
      observacoes: z.string().trim().optional(),
      origem: z.enum(["vazia", "abaixo_minimo", "estrutura"]).default("vazia"),
      raizId: z.string().trim().optional(),
      multiplicador: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(formulario));

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { titulo, observacoes, origem, raizId, multiplicador } = dados.data;

  const [cotacao] = await db
    .insert(cotacoes)
    .values({
      numero: await proximoNumero("COT"),
      titulo,
      observacoes: observacoes || null,
      criadoPor: sessao.id,
    })
    .returning();

  /* Os dois atalhos que evitam digitar item por item: repor o que esta
     faltando, ou cotar tudo que entra num equipamento. */
  let aCotar: { itemId: string; quantidade: number }[] = [];

  if (origem === "abaixo_minimo") {
    const lista = await listarItensComSaldo();
    aCotar = lista
      .filter((i) => i.situacao === "falta" || i.situacao === "abaixo_minimo")
      .map((i) => ({
        itemId: i.id,
        /* Repoe ate o minimo; sem minimo definido, sugere 1 para a pessoa ajustar. */
        quantidade: Math.max(i.estoqueMinimo - i.disponivel, 1),
      }));
  } else if (origem === "estrutura" && raizId) {
    const fator = Number((multiplicador ?? "1").replace(",", ".")) || 1;
    aCotar = await explodirMolde(raizId, fator);
  }

  if (aCotar.length > 0) {
    await db
      .insert(cotacaoItens)
      .values(aCotar.map((i) => ({ cotacaoId: cotacao.id, ...i })))
      .onConflictDoNothing();
    await preencherPrecosConhecidos(cotacao.id);
  }

  await registrar({
    usuarioId: sessao.id,
    tabela: "cotacoes",
    registroId: cotacao.id,
    acao: "criar",
    depois: cotacao,
  });

  revalidatePath("/compras/cotacoes");
  return { ok: true, id: cotacao.id };
}

/**
 * Traz para a cotacao os precos que ja estao nos vinculos item/fornecedor.
 * A pessoa abre o comparativo com os valores de referencia preenchidos e so
 * corrige o que o fornecedor respondeu diferente.
 */
async function preencherPrecosConhecidos(cotacaoId: string) {
  const linhas = await db
    .select({ id: cotacaoItens.id, itemId: cotacaoItens.itemId })
    .from(cotacaoItens)
    .where(eq(cotacaoItens.cotacaoId, cotacaoId));

  if (linhas.length === 0) return;

  const conhecidos = await db
    .select()
    .from(itemFornecedores)
    .where(inArray(itemFornecedores.itemId, linhas.map((l) => l.itemId)));

  const porItem = new Map<string, typeof conhecidos>();
  for (const c of conhecidos) {
    porItem.set(c.itemId, [...(porItem.get(c.itemId) ?? []), c]);
  }

  const aInserir = linhas.flatMap((linha) =>
    (porItem.get(linha.itemId) ?? []).map((c) => ({
      cotacaoItemId: linha.id,
      fornecedorId: c.fornecedorId,
      precoUnitario: c.preco,
      prazoValor: c.prazoValor,
      prazoUnidade: c.prazoUnidade,
    })),
  );

  if (aInserir.length > 0) {
    await db.insert(cotacaoPrecos).values(aInserir).onConflictDoNothing();
  }

  await marcarVencedorUnico(cotacaoId);
}

/**
 * Item que ficou com um preco so nasce ja escolhido.
 *
 * Ter preco do fornecedor na tela nao era a mesma coisa que ter vencedor
 * marcado, e a diferenca nao aparecia: cotando um equipamento inteiro, os
 * precos do cadastro vinham preenchidos sozinhos e a tela ficava com cara de
 * pronta, mas sem nenhum `escolhido`. Ai o pedido saia com um item so — ou
 * nenhum. Com um unico preco nao ha o que comparar, entao marcar e so dizer
 * o obvio; quem tem mais de um continua decidindo a mao.
 */
async function marcarVencedorUnico(cotacaoId: string) {
  const precos = await db
    .select({
      id: cotacaoPrecos.id,
      cotacaoItemId: cotacaoPrecos.cotacaoItemId,
      precoUnitario: cotacaoPrecos.precoUnitario,
      escolhido: cotacaoPrecos.escolhido,
    })
    .from(cotacaoPrecos)
    .innerJoin(cotacaoItens, eq(cotacaoItens.id, cotacaoPrecos.cotacaoItemId))
    .where(eq(cotacaoItens.cotacaoId, cotacaoId));

  const porItem = new Map<string, typeof precos>();
  for (const p of precos) {
    porItem.set(p.cotacaoItemId, [...(porItem.get(p.cotacaoItemId) ?? []), p]);
  }

  const unicos = [...porItem.values()]
    .filter((lista) => lista.length === 1 && lista[0].precoUnitario > 0 && !lista[0].escolhido)
    .map((lista) => lista[0].id);

  if (unicos.length === 0) return;

  await db.update(cotacaoPrecos).set({ escolhido: true }).where(inArray(cotacaoPrecos.id, unicos));
}

export async function adicionarItemNaCotacao(
  cotacaoId: string,
  itemId: string,
  quantidade: number,
): Promise<{ erro?: string }> {
  await exigirEdicao();
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { erro: "Informe uma quantidade maior que zero." };
  }

  const inseridos = await db
    .insert(cotacaoItens)
    .values({ cotacaoId, itemId, quantidade })
    .onConflictDoNothing()
    .returning();

  if (inseridos.length === 0) return { erro: "Esse item já está na cotação." };

  await preencherPrecosConhecidos(cotacaoId);
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  return {};
}

export async function removerItemDaCotacao(id: string, cotacaoId: string) {
  await exigirEdicao();
  await db.delete(cotacaoItens).where(eq(cotacaoItens.id, id));
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
}

export async function atualizarQuantidadeCotacao(
  id: string,
  cotacaoId: string,
  quantidade: number,
) {
  await exigirEdicao();
  if (!Number.isFinite(quantidade) || quantidade <= 0) return;
  await db.update(cotacaoItens).set({ quantidade }).where(eq(cotacaoItens.id, id));
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
}

/** Grava (ou atualiza) o preco de um fornecedor para um item cotado. */
export async function salvarPrecoCotado(dados: {
  cotacaoId: string;
  cotacaoItemId: string;
  fornecedorId: string;
  precoUnitario: number;
  prazoValor: number;
  prazoUnidade: "horas" | "dias";
  frete: number;
  observacao?: string;
}): Promise<{ erro?: string }> {
  await exigirEdicao();

  const { cotacaoId, ...campos } = dados;
  if (!Number.isFinite(campos.precoUnitario) || campos.precoUnitario < 0) {
    return { erro: "Preço inválido." };
  }

  await db
    .insert(cotacaoPrecos)
    .values(campos)
    .onConflictDoUpdate({
      target: [cotacaoPrecos.cotacaoItemId, cotacaoPrecos.fornecedorId],
      set: {
        precoUnitario: campos.precoUnitario,
        prazoValor: campos.prazoValor,
        prazoUnidade: campos.prazoUnidade,
        frete: campos.frete,
        observacao: campos.observacao ?? null,
      },
    });

  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  return {};
}

/** Marca o vencedor daquele item. Só um por item. */
export async function escolherFornecedor(
  cotacaoId: string,
  cotacaoItemId: string,
  precoId: string | null,
) {
  await exigirEdicao();

  await db
    .update(cotacaoPrecos)
    .set({ escolhido: false })
    .where(eq(cotacaoPrecos.cotacaoItemId, cotacaoItemId));

  if (precoId) {
    await db.update(cotacaoPrecos).set({ escolhido: true }).where(eq(cotacaoPrecos.id, precoId));
  }

  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
}

/**
 * Marca o menor preco de cada item que ainda nao tem vencedor.
 *
 * So mexe em quem esta sem escolha: decisao ja tomada nao se sobrescreve —
 * quem escolheu o mais caro tinha motivo (prazo, frete, confianca), e um
 * botao de atalho nao pode desfazer isso calado.
 */
export async function escolherMenoresPrecos(
  cotacaoId: string,
): Promise<{ erro?: string; marcados?: number }> {
  await exigirEdicao();

  const precos = await db
    .select({
      id: cotacaoPrecos.id,
      cotacaoItemId: cotacaoPrecos.cotacaoItemId,
      precoUnitario: cotacaoPrecos.precoUnitario,
      escolhido: cotacaoPrecos.escolhido,
    })
    .from(cotacaoPrecos)
    .innerJoin(cotacaoItens, eq(cotacaoItens.id, cotacaoPrecos.cotacaoItemId))
    .where(eq(cotacaoItens.cotacaoId, cotacaoId));

  const porItem = new Map<string, typeof precos>();
  for (const p of precos) {
    porItem.set(p.cotacaoItemId, [...(porItem.get(p.cotacaoItemId) ?? []), p]);
  }

  const aMarcar: string[] = [];
  for (const lista of porItem.values()) {
    if (lista.some((p) => p.escolhido)) continue;
    /* Preco zerado e "nao respondeu", nao "de graca". */
    const validos = lista.filter((p) => p.precoUnitario > 0);
    if (validos.length === 0) continue;
    aMarcar.push(validos.reduce((a, b) => (b.precoUnitario < a.precoUnitario ? b : a)).id);
  }

  if (aMarcar.length > 0) {
    await db
      .update(cotacaoPrecos)
      .set({ escolhido: true })
      .where(inArray(cotacaoPrecos.id, aMarcar));
  }

  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  return { marcados: aMarcar.length };
}

export async function removerPrecoCotado(cotacaoId: string, precoId: string) {
  await exigirEdicao();
  await db.delete(cotacaoPrecos).where(eq(cotacaoPrecos.id, precoId));
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
}

export async function atualizarStatusCotacao(
  id: string,
  status: "rascunho" | "enviada" | "respondida" | "fechada" | "cancelada",
) {
  const sessao = await exigirEdicao();
  await db.update(cotacoes).set({ status }).where(eq(cotacoes.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "cotacoes",
    registroId: id,
    acao: "atualizar",
    depois: { status },
  });
  revalidatePath(`/compras/cotacoes/${id}`);
  revalidatePath("/compras/cotacoes");
}

/**
 * Gera um pedido por fornecedor escolhido — um fornecedor com tres itens
 * vencedores vira um pedido so, com as tres linhas.
 *
 * Fecha a cotacao apenas quando nao sobra item para comprar. Antes fechava
 * sempre, e isso apagava trabalho sem avisar: item sem vencedor nao virava
 * linha de pedido nenhuma, e com a cotacao fechada ele tambem nao podia mais
 * ser escolhido — sumia. Numa cotacao montada a partir de um equipamento,
 * onde entram dezenas de itens de uma vez, bastava esquecer um.
 */
export async function gerarPedidos(
  cotacaoId: string,
): Promise<{ erro?: string; pedidos?: number; itens?: number; pendentes?: number }> {
  const sessao = await exigirEdicao();

  /* O que ja virou pedido nao vira de novo: a cotacao pode ficar aberta
     depois de uma geracao parcial, e gerar outra vez duplicaria as linhas. */
  const jaPedidos = await itensJaPedidos(cotacaoId);

  const vencedores = await db
    .select({
      itemId: cotacaoItens.itemId,
      quantidade: cotacaoItens.quantidade,
      fornecedorId: cotacaoPrecos.fornecedorId,
      precoUnitario: cotacaoPrecos.precoUnitario,
      frete: cotacaoPrecos.frete,
    })
    .from(cotacaoPrecos)
    .innerJoin(cotacaoItens, eq(cotacaoItens.id, cotacaoPrecos.cotacaoItemId))
    .where(and(eq(cotacaoItens.cotacaoId, cotacaoId), eq(cotacaoPrecos.escolhido, true)));

  const escolhidos = vencedores.filter((v) => !jaPedidos.has(v.itemId));

  if (escolhidos.length === 0) {
    return {
      erro: vencedores.length > 0
        ? "Todos os itens escolhidos desta cotação já viraram pedido."
        : "Escolha o fornecedor vencedor de pelo menos um item antes de gerar o pedido.",
    };
  }

  const porFornecedor = new Map<string, typeof escolhidos>();
  for (const e of escolhidos) {
    porFornecedor.set(e.fornecedorId, [...(porFornecedor.get(e.fornecedorId) ?? []), e]);
  }

  for (const [fornecedorId, linhas] of porFornecedor) {
    const [pedido] = await db
      .insert(pedidosCompra)
      .values({
        numero: await proximoNumero("PC"),
        cotacaoId,
        fornecedorId,
        /* O frete e do pedido, nao de cada linha: cobra uma vez so. */
        frete: Math.max(...linhas.map((l) => l.frete)),
        criadoPor: sessao.id,
      })
      .returning();

    await db.insert(pedidoItens).values(
      linhas.map((l) => ({
        pedidoId: pedido.id,
        itemId: l.itemId,
        quantidade: l.quantidade,
        precoUnitario: l.precoUnitario,
      })),
    );

    await registrar({
      usuarioId: sessao.id,
      tabela: "pedidos_compra",
      registroId: pedido.id,
      acao: "criar",
      depois: pedido,
    });
  }

  /* O que sobrou sem virar pedido: nem vencedor marcado, nem comprado antes. */
  const todos = await db
    .select({ itemId: cotacaoItens.itemId })
    .from(cotacaoItens)
    .where(eq(cotacaoItens.cotacaoId, cotacaoId));

  const comprados = new Set([...jaPedidos, ...escolhidos.map((e) => e.itemId)]);
  const pendentes = todos.filter((t) => !comprados.has(t.itemId)).length;

  /* Fecha so quando nao sobrou nada. Com item pendente a cotacao continua
     editavel — e "respondida", que e o que ela de fato e: tem preco, tem
     parte comprada, e ainda falta decidir o resto. */
  await db
    .update(cotacoes)
    .set({ status: pendentes === 0 ? "fechada" : "respondida" })
    .where(eq(cotacoes.id, cotacaoId));

  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  revalidatePath("/compras/cotacoes");
  revalidatePath("/compras/pedidos");
  revalidatePath("/");
  return { pedidos: porFornecedor.size, itens: escolhidos.length, pendentes };
}

/* -------------------------------------------------------------- Pedido --- */

/**
 * Recebimento. Gera a entrada no estoque, atualiza o recebido do pedido e
 * puxa o custo unitario do item para o preco efetivamente pago — sem isso o
 * valor do estoque congela no custo de cadastro.
 */
export async function receberItemDoPedido(
  pedidoItemId: string,
  quantidade: number,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { erro: "Informe uma quantidade maior que zero." };
  }

  const [linha] = await db
    .select({
      id: pedidoItens.id,
      pedidoId: pedidoItens.pedidoId,
      itemId: pedidoItens.itemId,
      quantidade: pedidoItens.quantidade,
      recebida: pedidoItens.quantidadeRecebida,
      precoUnitario: pedidoItens.precoUnitario,
      numero: pedidosCompra.numero,
    })
    .from(pedidoItens)
    .innerJoin(pedidosCompra, eq(pedidosCompra.id, pedidoItens.pedidoId))
    .where(eq(pedidoItens.id, pedidoItemId));

  if (!linha) return { erro: "Linha do pedido não encontrada." };

  const pendente = linha.quantidade - linha.recebida;
  if (quantidade > pendente) {
    return { erro: `Faltam apenas ${pendente} para completar esta linha.` };
  }

  await db.insert(movimentos).values({
    itemId: linha.itemId,
    tipo: "entrada_compra",
    quantidade,
    referencia: linha.numero,
    usuarioId: sessao.id,
    observacao: `Recebimento do pedido ${linha.numero}`,
    pedidoItemId: linha.id,
  });

  await db
    .update(pedidoItens)
    .set({ quantidadeRecebida: linha.recebida + quantidade })
    .where(eq(pedidoItens.id, pedidoItemId));

  await db
    .update(itens)
    .set({ custoUnitario: linha.precoUnitario, atualizadoEm: new Date() })
    .where(eq(itens.id, linha.itemId));

  await atualizarStatusPedido(linha.pedidoId);

  revalidatePath(`/compras/pedidos/${linha.pedidoId}`);
  revalidatePath("/compras/pedidos");
  revalidatePath("/estoque");
  revalidatePath("/itens");
  revalidatePath("/");
  return {};
}

/**
 * Devolução ao fornecedor.
 *
 * Devolve tudo o que aquela linha recebeu — na prática a devolução é do
 * produto inteiro, e um campo de quantidade ali só atrapalharia a decisão.
 * O recebido não é desfeito: a linha foi recebida mesmo, e zerar isso faria
 * o pedido voltar a "aberto" e oferecer receber de novo o que já voltou. O
 * que sai do saldo é um movimento novo, de tipo próprio, para o histórico
 * distinguir devolução de ajuste.
 *
 * O custo unitário do item fica onde está: foi o preço pago de verdade, e
 * devolver não descobre um preço melhor.
 */
export async function devolverItemDoPedido(
  pedidoItemId: string,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [linha] = await db
    .select({
      id: pedidoItens.id,
      pedidoId: pedidoItens.pedidoId,
      itemId: pedidoItens.itemId,
      recebida: pedidoItens.quantidadeRecebida,
      devolvida: pedidoItens.quantidadeDevolvida,
      numero: pedidosCompra.numero,
      status: pedidosCompra.status,
    })
    .from(pedidoItens)
    .innerJoin(pedidosCompra, eq(pedidosCompra.id, pedidoItens.pedidoId))
    .where(eq(pedidoItens.id, pedidoItemId));

  if (!linha) return { erro: "Linha do pedido não encontrada." };
  if (linha.status === "cancelado") return { erro: "Este pedido está cancelado." };
  if (linha.recebida <= 0) {
    return { erro: "Nada foi recebido nesta linha — não há o que devolver." };
  }
  if (linha.devolvida > 0) return { erro: "Esta linha já foi devolvida." };

  await db.insert(movimentos).values({
    itemId: linha.itemId,
    tipo: "devolucao_compra",
    quantidade: linha.recebida,
    referencia: linha.numero,
    usuarioId: sessao.id,
    observacao: `Devolução ao fornecedor do pedido ${linha.numero}`,
    pedidoItemId: linha.id,
  });

  await db
    .update(pedidoItens)
    .set({ quantidadeDevolvida: linha.recebida })
    .where(eq(pedidoItens.id, pedidoItemId));

  await registrar({
    usuarioId: sessao.id,
    tabela: "pedido_itens",
    registroId: linha.id,
    acao: "atualizar",
    antes: { quantidadeDevolvida: linha.devolvida },
    depois: { quantidadeDevolvida: linha.recebida },
  });

  revalidatePath(`/compras/pedidos/${linha.pedidoId}`);
  revalidatePath("/compras/pedidos");
  revalidatePath("/estoque");
  revalidatePath("/itens");
  revalidatePath("/");
  return {};
}

/**
 * Parâmetros de compra da linha: o texto livre que diz o que escolher no site
 * do fornecedor — cor, tamanho, voltagem, o kit de 50 em vez do avulso.
 *
 * Fica na linha do pedido, e não no cadastro do item, porque a escolha muda
 * de compra para compra. É o campo que sai em destaque no PDF que vai para
 * quem compra, que não tem acesso ao sistema para conferir.
 */
export async function salvarParametrosCompra(
  pedidoItemId: string,
  texto: string,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  const limpo = texto.trim();

  const [linha] = await db
    .update(pedidoItens)
    .set({ parametrosCompra: limpo || null })
    .where(eq(pedidoItens.id, pedidoItemId))
    .returning();

  if (!linha) return { erro: "Linha do pedido não encontrada." };

  await registrar({
    usuarioId: sessao.id,
    tabela: "pedido_itens",
    registroId: linha.id,
    acao: "atualizar",
    depois: { parametrosCompra: limpo || null },
  });

  revalidatePath(`/compras/pedidos/${linha.pedidoId}`);
  return {};
}

/** O status do pedido é derivado das linhas, nunca digitado à mão. */
async function atualizarStatusPedido(pedidoId: string) {
  const linhas = await db
    .select({ quantidade: pedidoItens.quantidade, recebida: pedidoItens.quantidadeRecebida })
    .from(pedidoItens)
    .where(eq(pedidoItens.pedidoId, pedidoId));

  const tudoRecebido = linhas.every((l) => l.recebida >= l.quantidade);
  const algoRecebido = linhas.some((l) => l.recebida > 0);

  await db
    .update(pedidosCompra)
    .set({ status: tudoRecebido ? "recebido" : algoRecebido ? "parcial" : "aberto" })
    .where(eq(pedidosCompra.id, pedidoId));
}

export async function cancelarPedido(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const recebido = await db
    .select({ id: pedidoItens.id })
    .from(pedidoItens)
    .where(and(eq(pedidoItens.pedidoId, id), sql`${pedidoItens.quantidadeRecebida} > 0`))
    .limit(1);

  if (recebido.length > 0) {
    return {
      erro:
        "Este pedido já teve recebimento e não pode ser cancelado. " +
        "Estorne as entradas na tela de Estoque, se for o caso.",
    };
  }

  await db.update(pedidosCompra).set({ status: "cancelado" }).where(eq(pedidosCompra.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "pedidos_compra",
    registroId: id,
    acao: "atualizar",
    depois: { status: "cancelado" },
  });
  revalidatePath("/compras/pedidos");
  revalidatePath(`/compras/pedidos/${id}`);
  return {};
}
