"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { carros, montagens, versoes } from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { ehDuplicado } from "@/lib/erros";
import { definirEquipamentoDoCarro } from "./montagens";

/* ---------------------------------------------------------------- Carro --- */

/**
 * Placa guardada sempre no mesmo formato: maiúscula, sem traço e sem espaço.
 * Sem isso "abc1d23", "ABC-1D23" e "ABC 1D23" viram três carros diferentes na
 * busca, e é por ela que o equipamento é achado no pátio.
 */
function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/* Cobre o padrão antigo (ABC1234) e o Mercosul (ABC1D23). */
const PLACA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

const esquemaCarro = z.object({
  id: z.uuid().optional(),
  placa: z
    .string()
    .trim()
    .min(1, "Informe a placa")
    .transform(normalizarPlaca)
    .refine((p) => PLACA.test(p), "Placa inválida. Use o formato ABC1D23 ou ABC1234."),
  fabricante: z.string().trim().min(1, "Informe o fabricante"),
  modelo: z.string().trim().min(1, "Informe o modelo"),
  pc: z.string().trim().optional(),
  versaoSistemaId: z.string().trim().optional(),
  versaoTabletId: z.string().trim().optional(),
  /* O campo "equipamento": qual montagem está instalada neste carro. */
  montagemId: z.string().trim().optional(),
});

export type EstadoCarro = { erro?: string; campo?: string; ok?: boolean; id?: string };

export async function salvarCarro(
  _estado: EstadoCarro,
  formulario: FormData,
): Promise<EstadoCarro> {
  const sessao = await exigirEdicao();

  const dados = esquemaCarro.safeParse(Object.fromEntries(formulario));
  if (!dados.success) {
    const problema = dados.error.issues[0];
    return { erro: problema?.message ?? "Dados inválidos", campo: String(problema?.path[0]) };
  }

  const { id, montagemId, ...campos } = dados.data;
  const valores = {
    ...campos,
    pc: campos.pc || null,
    versaoSistemaId: campos.versaoSistemaId || null,
    versaoTabletId: campos.versaoTabletId || null,
  };

  try {
    let carroId = id;

    if (id) {
      const [antes] = await db.select().from(carros).where(eq(carros.id, id));
      const [depois] = await db
        .update(carros)
        .set({ ...valores, atualizadoEm: new Date(), atualizadoPor: sessao.id })
        .where(eq(carros.id, id))
        .returning();
      await registrar({
        usuarioId: sessao.id,
        tabela: "carros",
        registroId: id,
        acao: "atualizar",
        antes,
        depois,
      });
    } else {
      const [criado] = await db
        .insert(carros)
        .values({ ...valores, criadoPor: sessao.id, atualizadoPor: sessao.id })
        .returning();
      carroId = criado.id;
      await registrar({
        usuarioId: sessao.id,
        tabela: "carros",
        registroId: criado.id,
        acao: "criar",
        depois: criado,
      });
    }

    /* O equipamento vem depois do carro existir, e por um caminho próprio:
       instalar e tirar mexem no estoque, não são só um campo gravado. */
    const equipamento = await definirEquipamentoDoCarro(carroId!, montagemId || null);
    if (equipamento.erro) return { erro: equipamento.erro, campo: "montagemId", id: carroId };

    revalidatePath("/carros");
    return { ok: true, id: carroId };
  } catch (e) {
    if (ehDuplicado(e)) {
      return { erro: "Já existe um carro com essa placa.", campo: "placa" };
    }
    console.error(e);
    return { erro: "Não foi possível salvar o carro." };
  }
}

export async function excluirCarro(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(carros).where(eq(carros.id, id));
  if (!antes) return { erro: "Carro não encontrado." };

  const [equipamento] = await db.select().from(montagens).where(eq(montagens.carroId, id));
  if (equipamento) {
    return {
      erro:
        `O equipamento ${equipamento.numero} ainda está instalado neste carro. ` +
        "Tire o equipamento antes de excluir — assim ele volta para o estoque.",
    };
  }

  await db.delete(carros).where(eq(carros.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "carros",
    registroId: id,
    acao: "excluir",
    antes,
  });

  revalidatePath("/carros");
  return {};
}

/* --------------------------------------------------------------- Versão --- */

const esquemaVersao = z.object({
  id: z.uuid().optional(),
  tipo: z.enum(["sistema", "tablet"]),
  numero: z.string().trim().min(1, "Informe o número da versão"),
  notas: z.string().trim().optional(),
  lancadaEm: z.string().trim().optional(),
});

export type EstadoVersao = { erro?: string; campo?: string; ok?: boolean };

export async function salvarVersao(
  _estado: EstadoVersao,
  formulario: FormData,
): Promise<EstadoVersao> {
  const sessao = await exigirEdicao();

  const dados = esquemaVersao.safeParse(Object.fromEntries(formulario));
  if (!dados.success) {
    const problema = dados.error.issues[0];
    return { erro: problema?.message ?? "Dados inválidos", campo: String(problema?.path[0]) };
  }

  const { id, ...campos } = dados.data;
  const valores = {
    ...campos,
    notas: campos.notas || null,
    lancadaEm: campos.lancadaEm || null,
  };

  try {
    if (id) {
      const [antes] = await db.select().from(versoes).where(eq(versoes.id, id));
      const [depois] = await db
        .update(versoes)
        .set(valores)
        .where(eq(versoes.id, id))
        .returning();
      await registrar({
        usuarioId: sessao.id,
        tabela: "versoes",
        registroId: id,
        acao: "atualizar",
        antes,
        depois,
      });
    } else {
      const [criada] = await db.insert(versoes).values(valores).returning();
      await registrar({
        usuarioId: sessao.id,
        tabela: "versoes",
        registroId: criada.id,
        acao: "criar",
        depois: criada,
      });
    }

    revalidatePath("/carros/versoes");
    revalidatePath("/carros");
    return { ok: true };
  } catch (e) {
    if (ehDuplicado(e)) {
      return { erro: "Essa versão já está cadastrada para este tipo.", campo: "numero" };
    }
    console.error(e);
    return { erro: "Não foi possível salvar a versão." };
  }
}

/**
 * Versão em uso não se apaga: o carro perderia a informação de o que está
 * rodando nele sem ninguém perceber.
 */
export async function excluirVersao(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(versoes).where(eq(versoes.id, id));
  if (!antes) return { erro: "Versão não encontrada." };

  const emUso = await db
    .select({ placa: carros.placa })
    .from(carros)
    .where(or(eq(carros.versaoSistemaId, id), eq(carros.versaoTabletId, id)));

  if (emUso.length > 0) {
    return {
      erro:
        `Esta versão está em uso em ${emUso.length} ${emUso.length === 1 ? "carro" : "carros"} ` +
        `(${emUso.slice(0, 3).map((c) => c.placa).join(", ")}${emUso.length > 3 ? "..." : ""}). ` +
        "Troque a versão desses carros antes de excluir.",
    };
  }

  await db.delete(versoes).where(eq(versoes.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "versoes",
    registroId: id,
    acao: "excluir",
    antes,
  });

  revalidatePath("/carros/versoes");
  return {};
}
