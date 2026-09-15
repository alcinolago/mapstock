"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { fornecedores, itemFornecedores } from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";

const esquema = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(1, "Informe o nome do fornecedor"),
  contato: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email("E-mail inválido")]).optional(),
  site: z.string().trim().optional(),
  condicaoPagamento: z.string().trim().optional(),
  frete: z.string().trim().optional(),
  status: z.enum(["preferencial", "aprovado", "em_avaliacao", "emergencia", "bloqueado"]),
  observacoes: z.string().trim().optional(),
  ativo: z.coerce.boolean(),
});

export type EstadoFornecedor = { erro?: string; campo?: string; ok?: boolean };

export async function salvarFornecedor(
  _estado: EstadoFornecedor,
  formulario: FormData,
): Promise<EstadoFornecedor> {
  const sessao = await exigirEdicao();

  const dados = esquema.safeParse({
    ...Object.fromEntries(formulario),
    ativo: formulario.get("ativo") === "on" || formulario.get("ativo") === "true",
  });

  if (!dados.success) {
    const problema = dados.error.issues[0];
    return { erro: problema?.message ?? "Dados inválidos", campo: String(problema?.path[0]) };
  }

  const { id, ...campos } = dados.data;
  const valores = {
    ...campos,
    contato: campos.contato || null,
    telefone: campos.telefone || null,
    email: campos.email || null,
    site: campos.site || null,
    condicaoPagamento: campos.condicaoPagamento || null,
    frete: campos.frete || null,
    observacoes: campos.observacoes || null,
  };

  try {
    if (id) {
      const [antes] = await db.select().from(fornecedores).where(eq(fornecedores.id, id));
      const [depois] = await db
        .update(fornecedores)
        .set(valores)
        .where(eq(fornecedores.id, id))
        .returning();
      await registrar({
        usuarioId: sessao.id,
        tabela: "fornecedores",
        registroId: id,
        acao: "atualizar",
        antes,
        depois,
      });
    } else {
      const [criado] = await db.insert(fornecedores).values(valores).returning();
      await registrar({
        usuarioId: sessao.id,
        tabela: "fornecedores",
        registroId: criado.id,
        acao: "criar",
        depois: criado,
      });
    }

    revalidatePath("/fornecedores");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) {
      return { erro: "Já existe um fornecedor com esse nome.", campo: "nome" };
    }
    console.error(e);
    return { erro: "Não foi possível salvar o fornecedor." };
  }
}

/**
 * So exclui fornecedor que nao esta vinculado a nenhum item — senao os
 * precos de referencia dos itens sumiriam junto. Para tirar de circulacao
 * sem perder historico, existe o campo "ativo".
 */
export async function excluirFornecedor(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(fornecedores).where(eq(fornecedores.id, id));
  if (!antes) return { erro: "Fornecedor não encontrado." };

  const vinculos = await db
    .select({ id: itemFornecedores.id })
    .from(itemFornecedores)
    .where(eq(itemFornecedores.fornecedorId, id))
    .limit(1);

  if (vinculos.length > 0) {
    return {
      erro:
        "Este fornecedor está vinculado a itens e não pode ser excluído. " +
        "Desative-o para tirá-lo das listas sem perder os preços já registrados.",
    };
  }

  await db.delete(fornecedores).where(eq(fornecedores.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "fornecedores",
    registroId: id,
    acao: "excluir",
    antes,
  });
  revalidatePath("/fornecedores");
  return {};
}
