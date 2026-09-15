"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { bom, itens } from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";

const esquema = z.object({
  paiId: z.uuid("Escolha o componente pai"),
  filhoId: z.uuid("Escolha o componente filho"),
  quantidade: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v > 0, "Informe uma quantidade maior que zero"),
  obrigatorio: z.coerce.boolean().default(true),
  localMontagem: z.string().trim().optional(),
});

export type EstadoEstrutura = { erro?: string; ok?: boolean };

/**
 * Porte de would_create_cycle() do desktop (linha 1042): desce a arvore a
 * partir do filho; se o pai aparecer la embaixo, o vinculo fecharia um laco
 * e a montagem passaria a conter a si mesma.
 */
async function criariaCiclo(paiId: string, filhoId: string): Promise<boolean> {
  if (paiId === filhoId) return true;

  const arestas = await db.select({ pai: bom.paiId, filho: bom.filhoId }).from(bom);
  const filhosDe = new Map<string, string[]>();
  for (const a of arestas) {
    filhosDe.set(a.pai, [...(filhosDe.get(a.pai) ?? []), a.filho]);
  }

  const pilha = [filhoId];
  const vistos = new Set<string>();
  while (pilha.length > 0) {
    const atual = pilha.pop()!;
    if (atual === paiId) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    pilha.push(...(filhosDe.get(atual) ?? []));
  }
  return false;
}

export async function vincularNaEstrutura(
  _estado: EstadoEstrutura,
  formulario: FormData,
): Promise<EstadoEstrutura> {
  const sessao = await exigirEdicao();

  const dados = esquema.safeParse({
    ...Object.fromEntries(formulario),
    obrigatorio: formulario.get("obrigatorio") !== "false",
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { paiId, filhoId, quantidade, obrigatorio, localMontagem } = dados.data;

  if (paiId === filhoId) {
    return { erro: "Um item não pode ser componente de si mesmo." };
  }
  if (await criariaCiclo(paiId, filhoId)) {
    return { erro: "Este vínculo criaria um ciclo na estrutura." };
  }

  const existente = await db
    .select({ id: bom.id })
    .from(bom)
    .where(and(eq(bom.paiId, paiId), eq(bom.filhoId, filhoId)))
    .limit(1);
  if (existente.length > 0) {
    return { erro: "Esse componente já está vinculado a este mesmo pai." };
  }

  const [{ proxima }] = await db
    .select({ proxima: sql<number>`coalesce(max(${bom.ordem}), 0) + 1` })
    .from(bom)
    .where(eq(bom.paiId, paiId));

  const [criado] = await db
    .insert(bom)
    .values({
      paiId,
      filhoId,
      quantidade,
      obrigatorio,
      localMontagem: localMontagem || null,
      ordem: proxima,
    })
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "bom",
    registroId: criado.id,
    acao: "criar",
    depois: criado,
  });

  revalidatePath("/estrutura");
  return { ok: true };
}

export async function desvincularDaEstrutura(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  const [antes] = await db.select().from(bom).where(eq(bom.id, id));
  if (!antes) return { erro: "Vínculo não encontrado." };

  await db.delete(bom).where(eq(bom.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "bom",
    registroId: id,
    acao: "excluir",
    antes,
  });
  revalidatePath("/estrutura");
  return {};
}

export async function atualizarQuantidadeEstrutura(
  id: string,
  quantidade: number,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { erro: "Informe uma quantidade maior que zero." };
  }
  await db.update(bom).set({ quantidade }).where(eq(bom.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "bom",
    registroId: id,
    acao: "atualizar",
    depois: { quantidade },
  });
  revalidatePath("/estrutura");
  return {};
}

/**
 * Sobe ou desce um componente dentro da mesma montagem.
 *
 * Porte de move_bom() do desktop (linha 1128): troca a ordem com o vizinho,
 * em vez de renumerar a lista inteira. Nos extremos não faz nada.
 *
 * A ordem é o que define a sequência de montagem na tela de Estrutura — é
 * informação de processo, não enfeite: quem monta segue a lista de cima
 * para baixo.
 */
export async function moverNaEstrutura(
  id: string,
  direcao: "cima" | "baixo",
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [alvo] = await db.select().from(bom).where(eq(bom.id, id));
  if (!alvo) return { erro: "Vínculo não encontrado." };

  /* Irmãos: os outros componentes da mesma montagem, na ordem atual. */
  const irmaos = await db
    .select()
    .from(bom)
    .where(eq(bom.paiId, alvo.paiId))
    .orderBy(asc(bom.ordem), asc(bom.id));

  const posicao = irmaos.findIndex((v) => v.id === id);
  const destino = direcao === "cima" ? posicao - 1 : posicao + 1;
  if (destino < 0 || destino >= irmaos.length) return {};

  const vizinho = irmaos[destino];

  /* Empate de ordem (dado antigo, ou tudo em zero) faria a troca não surtir
     efeito nenhum. Nesse caso renumera pela posição atual antes de trocar. */
  if (alvo.ordem === vizinho.ordem) {
    for (const [i, v] of irmaos.entries()) {
      await db.update(bom).set({ ordem: i + 1 }).where(eq(bom.id, v.id));
    }
    await db.update(bom).set({ ordem: destino + 1 }).where(eq(bom.id, alvo.id));
    await db.update(bom).set({ ordem: posicao + 1 }).where(eq(bom.id, vizinho.id));
  } else {
    await db.update(bom).set({ ordem: vizinho.ordem }).where(eq(bom.id, alvo.id));
    await db.update(bom).set({ ordem: alvo.ordem }).where(eq(bom.id, vizinho.id));
  }

  await registrar({
    usuarioId: sessao.id,
    tabela: "bom",
    registroId: id,
    acao: "atualizar",
    antes: { ordem: alvo.ordem },
    depois: { ordem: vizinho.ordem },
  });

  revalidatePath("/estrutura");
  return {};
}

/**
 * Explode a estrutura de um item: devolve a lista achatada de componentes
 * com a quantidade total ja multiplicada nivel a nivel. E o que alimenta a
 * cotacao a partir de um equipamento.
 */
export async function explodirEstrutura(
  raizId: string,
  multiplicador = 1,
): Promise<{ itemId: string; quantidade: number }[]> {
  const arestas = await db
    .select({ pai: bom.paiId, filho: bom.filhoId, quantidade: bom.quantidade })
    .from(bom);

  const filhosDe = new Map<string, { filho: string; quantidade: number }[]>();
  for (const a of arestas) {
    filhosDe.set(a.pai, [...(filhosDe.get(a.pai) ?? []), { filho: a.filho, quantidade: a.quantidade }]);
  }

  const total = new Map<string, number>();

  function descer(id: string, fator: number, caminho: Set<string>) {
    /* Trava de seguranca: mesmo com a validacao na gravacao, um ciclo vindo
       de dados antigos nao pode travar a aplicacao num laco infinito. */
    if (caminho.has(id)) return;
    const novoCaminho = new Set(caminho).add(id);

    for (const { filho, quantidade } of filhosDe.get(id) ?? []) {
      const q = quantidade * fator;
      total.set(filho, (total.get(filho) ?? 0) + q);
      descer(filho, q, novoCaminho);
    }
  }

  descer(raizId, multiplicador, new Set());

  return [...total.entries()].map(([itemId, quantidade]) => ({ itemId, quantidade }));
}

/** Todos os itens, para os seletores de pai e filho. */
export async function itensParaEstrutura() {
  return db
    .select({
      id: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      nivel: itens.nivel,
    })
    .from(itens)
    .where(eq(itens.ativo, true))
    .orderBy(itens.nivel, itens.codigo);
}
