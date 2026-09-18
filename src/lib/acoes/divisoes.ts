"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { divisoes, moldeNos } from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";

/**
 * Divisao e so um nome: Domo, Estrutura, Fiacao, Fixacao.
 *
 * Ela nao tem conteudo proprio e nao pertence a molde nenhum — e um rotulo
 * reutilizavel, que cada molde usa como quiser. Por isso mora numa tela
 * propria, e nao dentro de um molde.
 */
export type EstadoDivisao = { erro?: string; ok?: boolean };

export async function salvarDivisao(
  _estado: EstadoDivisao,
  formulario: FormData,
): Promise<EstadoDivisao> {
  const sessao = await exigirEdicao();

  const id = (formulario.get("id") as string) || null;
  const nome = ((formulario.get("nome") as string) ?? "").trim();
  if (!nome) return { erro: "Informe o nome da divisão." };

  const [repetido] = await db
    .select({ id: divisoes.id })
    .from(divisoes)
    .where(sql`lower(${divisoes.nome}) = lower(${nome})`);
  if (repetido && repetido.id !== id) {
    return { erro: `Já existe uma divisão chamada "${nome}".` };
  }

  if (id) {
    const [antes] = await db.select().from(divisoes).where(eq(divisoes.id, id));
    if (!antes) return { erro: "Divisão não encontrada." };
    const [depois] = await db
      .update(divisoes)
      .set({ nome })
      .where(eq(divisoes.id, id))
      .returning();
    await registrar({
      usuarioId: sessao.id,
      tabela: "divisoes",
      registroId: id,
      acao: "atualizar",
      antes,
      depois,
    });
  } else {
    const [{ proxima }] = await db
      .select({ proxima: sql<number>`coalesce(max(${divisoes.ordem}), 0) + 1` })
      .from(divisoes);
    const [criada] = await db
      .insert(divisoes)
      .values({ nome, ordem: proxima, criadoPor: sessao.id })
      .returning();
    await registrar({
      usuarioId: sessao.id,
      tabela: "divisoes",
      registroId: criada.id,
      acao: "criar",
      depois: criada,
    });
  }

  revalidarTudo();
  return { ok: true };
}

/** Quantos moldes usam esta divisao — a tela mostra antes de deixar excluir. */
export async function usosDaDivisao(id: string): Promise<number> {
  const [linha] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(moldeNos)
    .where(eq(moldeNos.divisaoId, id));
  return linha?.n ?? 0;
}

export async function excluirDivisao(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(divisoes).where(eq(divisoes.id, id));
  if (!antes) return { erro: "Divisão não encontrada." };

  /* Molde em pe segura a divisao. Montagem nao: ela guarda o nome copiado,
     entao o passado nao depende deste cadastro para continuar legivel. */
  const usos = await usosDaDivisao(id);
  if (usos > 0) {
    return {
      erro: `${antes.nome} está em ${usos} ${usos === 1 ? "lugar" : "lugares"} de algum molde. Tire de lá antes de excluir, ou desative.`,
    };
  }

  await db.delete(divisoes).where(eq(divisoes.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "divisoes",
    registroId: id,
    acao: "excluir",
    antes,
  });
  revalidarTudo();
  return {};
}

export async function alternarDivisao(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  const [antes] = await db.select().from(divisoes).where(eq(divisoes.id, id));
  if (!antes) return { erro: "Divisão não encontrada." };

  const [depois] = await db
    .update(divisoes)
    .set({ ativo: !antes.ativo })
    .where(eq(divisoes.id, id))
    .returning();
  await registrar({
    usuarioId: sessao.id,
    tabela: "divisoes",
    registroId: id,
    acao: "atualizar",
    antes,
    depois,
  });
  revalidarTudo();
  return {};
}

export async function listarDivisoes() {
  return db.select().from(divisoes).orderBy(asc(divisoes.ordem), asc(divisoes.nome));
}

function revalidarTudo() {
  revalidatePath("/divisoes");
  revalidatePath("/estrutura");
}
