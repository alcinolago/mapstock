"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { saldoDoItem } from "@/db/consultas";
import { itens, movimentos } from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { EFEITO_MOVIMENTO, MOVIMENTOS, OPOSTO_MOVIMENTO } from "@/lib/labels";

const esquema = z.object({
  itemId: z.uuid("Escolha o item"),
  tipo: z.enum([
    "entrada_compra",
    "entrada_fabricacao",
    "saida_producao",
    "reserva",
    "liberacao_reserva",
    "ajuste_positivo",
    "ajuste_negativo",
  ]),
  quantidade: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v > 0, "A quantidade precisa ser maior que zero"),
  referencia: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
  /* Quando ligado, deixa passar uma saida que derruba o saldo abaixo de zero. */
  permitirNegativo: z.coerce.boolean().default(false),
});

export type EstadoMovimento = { erro?: string; ok?: boolean; aviso?: string };

export async function lancarMovimento(
  _estado: EstadoMovimento,
  formulario: FormData,
): Promise<EstadoMovimento> {
  const sessao = await exigirEdicao();

  const dados = esquema.safeParse({
    ...Object.fromEntries(formulario),
    permitirNegativo: formulario.get("permitirNegativo") === "on",
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { itemId, tipo, quantidade, referencia, observacao, permitirNegativo } = dados.data;

  const [item] = await db
    .select({ codigo: itens.codigo, descricao: itens.descricao })
    .from(itens)
    .where(eq(itens.id, itemId));
  if (!item) return { erro: "Item não encontrado." };

  /* Saida maior que o disponivel quase sempre e erro de digitacao. Barra por
     padrao e deixa passar so com a confirmacao explicita — inventario tem
     hora em que precisa acertar mesmo ficando negativo. */
  const efeito = EFEITO_MOVIMENTO[tipo];
  if (!permitirNegativo && (efeito.fisico === -1 || efeito.reservado === 1)) {
    const saldo = await saldoDoItem(itemId);
    if (quantidade > saldo.disponivel) {
      return {
        erro:
          `${item.codigo} tem apenas ${saldo.disponivel} disponível e você está lançando ` +
          `${quantidade}. Marque "permitir saldo negativo" se for mesmo isso.`,
      };
    }
  }

  const [criado] = await db
    .insert(movimentos)
    .values({
      itemId,
      tipo,
      quantidade,
      referencia: referencia || null,
      observacao: observacao || null,
      usuarioId: sessao.id,
    })
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "movimentos",
    registroId: criado.id,
    acao: "criar",
    depois: criado,
  });

  revalidatePath("/estoque");
  revalidatePath("/itens");
  revalidatePath("/");

  return {
    ok: true,
    aviso: `${MOVIMENTOS[tipo]} de ${quantidade} lançada em ${item.codigo}.`,
  };
}

/**
 * Movimento nao se apaga: se foi lancado errado, lanca-se o oposto. Assim o
 * historico continua contando a verdade do que aconteceu. A tabela do oposto
 * vive em labels.ts, junto do EFEITO_MOVIMENTO.
 */
export async function estornarMovimento(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [original] = await db.select().from(movimentos).where(eq(movimentos.id, id));
  if (!original) return { erro: "Movimentação não encontrada." };

  const [criado] = await db
    .insert(movimentos)
    .values({
      itemId: original.itemId,
      tipo: OPOSTO_MOVIMENTO[original.tipo],
      quantidade: original.quantidade,
      referencia: original.referencia,
      observacao: `Estorno da movimentação de ${original.criadoEm.toLocaleString("pt-BR")}`,
      usuarioId: sessao.id,
    })
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "movimentos",
    registroId: criado.id,
    acao: "criar",
    antes: original,
    depois: criado,
  });

  revalidatePath("/estoque");
  revalidatePath("/itens");
  revalidatePath("/");
  return {};
}
