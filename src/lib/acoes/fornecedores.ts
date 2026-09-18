"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  cotacaoItens,
  cotacaoPrecos,
  fornecedores,
  itemFornecedores,
  pedidosCompra,
} from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { ehDuplicado, ehVinculado } from "@/lib/erros";
import { contagens, emTexto, type Dependencias } from "@/lib/exclusao";

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

export type EstadoFornecedor = { erro?: string; campo?: string; ok?: boolean; id?: string };

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

  /* Devolve o id: quem cria pela janela do cadastro de item precisa dele
     para ja deixar o fornecedor escolhido na linha, sem recarregar a tela. */
  let salvoId = id;

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
      salvoId = criado.id;
      await registrar({
        usuarioId: sessao.id,
        tabela: "fornecedores",
        registroId: criado.id,
        acao: "criar",
        depois: criado,
      });
    }

    revalidatePath("/fornecedores");
    return { ok: true, id: salvoId };
  } catch (e) {
    if (ehDuplicado(e)) {
      return { erro: "Já existe um fornecedor com esse nome.", campo: "nome" };
    }
    console.error(e);
    return { erro: "Não foi possível salvar o fornecedor." };
  }
}

/**
 * O que segura a exclusao de um fornecedor, e o que vai junto.
 *
 * Bloqueia so cotacao e pedido, que sao documento. Estar vinculado a itens
 * nao bloqueia mais: aquilo e preco de referencia, some com o fornecedor e
 * o item continua inteiro — antes essa trava impedia excluir praticamente
 * qualquer fornecedor cadastrado.
 */
export async function dependenciasFornecedor(id: string): Promise<Dependencias> {
  await exigirEdicao();

  const [emCotacoes, emPedidos, comItens] = await Promise.all([
    db
      .select({ n: count() })
      .from(cotacaoPrecos)
      .innerJoin(cotacaoItens, eq(cotacaoItens.id, cotacaoPrecos.cotacaoItemId))
      .where(eq(cotacaoPrecos.fornecedorId, id)),
    db.select({ n: count() }).from(pedidosCompra).where(eq(pedidosCompra.fornecedorId, id)),
    db.select({ n: count() }).from(itemFornecedores).where(eq(itemFornecedores.fornecedorId, id)),
  ]);

  return {
    bloqueios: contagens([
      { quantidade: emCotacoes[0].n, singular: "preço cotado", plural: "preços cotados" },
      { quantidade: emPedidos[0].n, singular: "pedido de compra", plural: "pedidos de compra" },
    ]),
    junto: contagens([
      {
        quantidade: comItens[0].n,
        singular: "item com preço deste fornecedor",
        plural: "itens com preço deste fornecedor",
      },
    ]),
  };
}

/** Exclusao definitiva, depois de conferir o que a tela ja mostrou. */
export async function excluirFornecedor(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(fornecedores).where(eq(fornecedores.id, id));
  if (!antes) return { erro: "Fornecedor não encontrado." };

  const { bloqueios, junto } = await dependenciasFornecedor(id);
  if (bloqueios.length > 0) {
    return {
      erro:
        `Este fornecedor aparece em ${emTexto(bloqueios)} e não pode ser excluído. ` +
        "Desative-o para tirá-lo das listas sem perder o histórico de compra.",
    };
  }

  try {
    await db.delete(fornecedores).where(eq(fornecedores.id, id));
  } catch (e) {
    if (ehVinculado(e)) {
      return {
        erro:
          "Este fornecedor passou a ser usado em outro registro agora há pouco. " +
          "Recarregue a tela.",
      };
    }
    console.error(e);
    return { erro: "Não foi possível excluir o fornecedor. Tente de novo." };
  }

  await registrar({
    usuarioId: sessao.id,
    tabela: "fornecedores",
    registroId: id,
    acao: "excluir",
    antes: { ...antes, apagadoJunto: junto },
  });
  revalidatePath("/fornecedores");
  revalidatePath("/itens");
  return {};
}

/** Saida de quem nao pode ser excluido: some das listas, historico fica. */
export async function alternarAtivoFornecedor(id: string, ativo: boolean) {
  const sessao = await exigirEdicao();
  await db.update(fornecedores).set({ ativo }).where(eq(fornecedores.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "fornecedores",
    registroId: id,
    acao: "atualizar",
    depois: { ativo },
  });
  revalidatePath("/fornecedores");
}
