"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  aquisicoes,
  classificacoes,
  itens,
  itensParametros3d,
  locais,
  materiais3d,
  origensFabricacao,
  regrasClassificacao,
  unidades,
  usuarios,
} from "@/db/schema";
import { exigirAdmin, sessaoAtual } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";

type Resultado = { erro?: string; ok?: boolean };

/* ------------------------------------------------------- Classificações --- */

export async function salvarClassificacao(dados: {
  id?: string;
  nome: string;
  prefixoCodigo: string;
  ativo: boolean;
}): Promise<Resultado> {
  await exigirAdmin();

  const nome = dados.nome.trim();
  const prefixo = dados.prefixoCodigo.trim().toUpperCase();

  if (!nome) return { erro: "A classificação precisa de um nome." };
  if (!/^[A-Z]{2,5}$/.test(prefixo)) {
    return { erro: "O prefixo deve ter de 2 a 5 letras (ex.: FIX, IMP)." };
  }

  try {
    if (dados.id) {
      await db
        .update(classificacoes)
        .set({ nome, prefixoCodigo: prefixo, ativo: dados.ativo })
        .where(eq(classificacoes.id, dados.id));
    } else {
      const [{ proxima }] = await db
        .select({ proxima: sql<number>`coalesce(max(${classificacoes.ordem}), 0) + 1` })
        .from(classificacoes);
      await db
        .insert(classificacoes)
        .values({ nome, prefixoCodigo: prefixo, ordem: proxima, ativo: dados.ativo });
    }
    revalidatePath("/configuracoes");
    return { ok: true };
  } catch {
    return { erro: "Já existe uma classificação com esse nome." };
  }
}

export async function removerClassificacao(id: string): Promise<Resultado> {
  await exigirAdmin();
  const emUso = await db
    .select({ id: itens.id })
    .from(itens)
    .where(eq(itens.classificacaoId, id))
    .limit(1);
  if (emUso.length > 0) {
    return {
      erro: "Existem itens nesta classificação. Desative-a em vez de remover.",
    };
  }
  await db.delete(classificacoes).where(eq(classificacoes.id, id));
  revalidatePath("/configuracoes");
  return { ok: true };
}

/* ------------------------------------------------------------- Regras --- */

export async function adicionarRegra(
  classificacaoId: string,
  palavraChave: string,
): Promise<Resultado> {
  await exigirAdmin();
  const palavra = palavraChave.trim().toUpperCase();
  if (!palavra) return { erro: "Informe a palavra-chave." };

  try {
    const [{ proxima }] = await db
      .select({ proxima: sql<number>`coalesce(max(${regrasClassificacao.ordem}), 0) + 1` })
      .from(regrasClassificacao);
    await db
      .insert(regrasClassificacao)
      .values({ classificacaoId, palavraChave: palavra, ordem: proxima });
    revalidatePath("/configuracoes");
    return { ok: true };
  } catch {
    return { erro: `A palavra "${palavra}" já está em outra regra.` };
  }
}

export async function removerRegra(id: string): Promise<Resultado> {
  await exigirAdmin();
  await db.delete(regrasClassificacao).where(eq(regrasClassificacao.id, id));
  revalidatePath("/configuracoes");
  return { ok: true };
}

/* ------------------------------------------------------------ Unidades --- */

export async function salvarUnidade(dados: {
  id?: string;
  sigla: string;
  nome: string;
  ativo: boolean;
}): Promise<Resultado> {
  await exigirAdmin();
  const sigla = dados.sigla.trim();
  const nome = dados.nome.trim();
  if (!sigla || !nome) return { erro: "Informe a sigla e o nome da unidade." };

  try {
    if (dados.id) {
      await db.update(unidades).set({ sigla, nome, ativo: dados.ativo }).where(eq(unidades.id, dados.id));
    } else {
      await db.insert(unidades).values({ sigla, nome, ativo: dados.ativo });
    }
    revalidatePath("/configuracoes");
    return { ok: true };
  } catch {
    return { erro: "Já existe uma unidade com essa sigla." };
  }
}

export async function removerUnidade(id: string): Promise<Resultado> {
  await exigirAdmin();
  const emUso = await db.select({ id: itens.id }).from(itens).where(eq(itens.unidadeId, id)).limit(1);
  if (emUso.length > 0) {
    return { erro: "Existem itens com esta unidade. Desative-a em vez de remover." };
  }
  await db.delete(unidades).where(eq(unidades.id, id));
  revalidatePath("/configuracoes");
  return { ok: true };
}

/* --------------------------------------------------------------- Locais --- */

/**
 * Onde a peca fica guardada virou cadastro para o item so escolher de uma
 * lista. Texto livre criava "Gaveta B3", "gaveta b3" e "Gaveta B-3" como se
 * fossem tres lugares, e af nao dava para filtrar por prateleira.
 */
export async function salvarLocal(dados: {
  id?: string;
  nome: string;
  ativo: boolean;
}): Promise<Resultado> {
  await exigirAdmin();
  const nome = dados.nome.trim();
  if (!nome) return { erro: "Informe o nome do local." };

  try {
    if (dados.id) {
      await db.update(locais).set({ nome, ativo: dados.ativo }).where(eq(locais.id, dados.id));
    } else {
      await db.insert(locais).values({ nome, ativo: dados.ativo });
    }
    revalidatePath("/configuracoes");
    revalidatePath("/itens");
    return { ok: true };
  } catch {
    return { erro: "Já existe um local com esse nome." };
  }
}

export async function removerLocal(id: string): Promise<Resultado> {
  await exigirAdmin();
  const emUso = await db.select({ id: itens.id }).from(itens).where(eq(itens.localId, id)).limit(1);
  if (emUso.length > 0) {
    return { erro: "Existem itens guardados neste local. Desative-o em vez de remover." };
  }
  await db.delete(locais).where(eq(locais.id, id));
  revalidatePath("/configuracoes");
  return { ok: true };
}

/* ------------------------- Aquisição, origem e material de impressão 3D --- */

/**
 * As tres listas que eram enum no schema. Viraram cadastro porque toda lista
 * que o cadastro de item oferece num select precisa ser editavel aqui —
 * acrescentar "Comodato" em Aquisicao nao pode exigir migracao de banco.
 *
 * Todas tem a mesma forma, entao tem o mesmo par de acoes. O que varia e
 * onde procurar o uso antes de deixar apagar, e isso vem por parametro.
 */
export async function salvarAquisicao(dados: {
  id?: string;
  nome: string;
  ativo: boolean;
}): Promise<Resultado> {
  await exigirAdmin();
  const nome = dados.nome.trim();
  if (!nome) return { erro: "Informe o nome do tipo de aquisição." };

  try {
    if (dados.id) {
      await db
        .update(aquisicoes)
        .set({ nome, ativo: dados.ativo })
        .where(eq(aquisicoes.id, dados.id));
    } else {
      const [{ proxima }] = await db
        .select({ proxima: sql<number>`coalesce(max(${aquisicoes.ordem}), 0) + 1` })
        .from(aquisicoes);
      await db.insert(aquisicoes).values({ nome, ordem: proxima, ativo: dados.ativo });
    }
    revalidatePath("/configuracoes");
    revalidatePath("/itens");
    return { ok: true };
  } catch {
    return { erro: "Já existe um tipo de aquisição com esse nome." };
  }
}

export async function removerAquisicao(id: string): Promise<Resultado> {
  await exigirAdmin();
  const emUso = await db
    .select({ id: itens.id })
    .from(itens)
    .where(eq(itens.aquisicaoId, id))
    .limit(1);
  if (emUso.length > 0) {
    return { erro: "Existem itens com esta aquisição. Desative-a em vez de remover." };
  }
  await db.delete(aquisicoes).where(eq(aquisicoes.id, id));
  revalidatePath("/configuracoes");
  revalidatePath("/itens");
  return { ok: true };
}

export async function salvarOrigemFabricacao(dados: {
  id?: string;
  nome: string;
  abreParametros3d: boolean;
  ativo: boolean;
}): Promise<Resultado> {
  await exigirAdmin();
  const nome = dados.nome.trim();
  if (!nome) return { erro: "Informe o nome da origem." };

  try {
    if (dados.id) {
      await db
        .update(origensFabricacao)
        .set({ nome, abreParametros3d: dados.abreParametros3d, ativo: dados.ativo })
        .where(eq(origensFabricacao.id, dados.id));
    } else {
      const [{ proxima }] = await db
        .select({ proxima: sql<number>`coalesce(max(${origensFabricacao.ordem}), 0) + 1` })
        .from(origensFabricacao);
      await db.insert(origensFabricacao).values({
        nome,
        abreParametros3d: dados.abreParametros3d,
        ordem: proxima,
        ativo: dados.ativo,
      });
    }
    revalidatePath("/configuracoes");
    revalidatePath("/itens");
    return { ok: true };
  } catch {
    return { erro: "Já existe uma origem de fabricação com esse nome." };
  }
}

export async function removerOrigemFabricacao(id: string): Promise<Resultado> {
  await exigirAdmin();
  const emUso = await db
    .select({ id: itens.id })
    .from(itens)
    .where(eq(itens.origemFabricacaoId, id))
    .limit(1);
  if (emUso.length > 0) {
    return { erro: "Existem itens com esta origem. Desative-a em vez de remover." };
  }
  await db.delete(origensFabricacao).where(eq(origensFabricacao.id, id));
  revalidatePath("/configuracoes");
  revalidatePath("/itens");
  return { ok: true };
}

export async function salvarMaterial3d(dados: {
  id?: string;
  nome: string;
  ativo: boolean;
}): Promise<Resultado> {
  await exigirAdmin();
  const nome = dados.nome.trim();
  if (!nome) return { erro: "Informe o nome do material." };

  try {
    if (dados.id) {
      await db
        .update(materiais3d)
        .set({ nome, ativo: dados.ativo })
        .where(eq(materiais3d.id, dados.id));
    } else {
      const [{ proxima }] = await db
        .select({ proxima: sql<number>`coalesce(max(${materiais3d.ordem}), 0) + 1` })
        .from(materiais3d);
      await db.insert(materiais3d).values({ nome, ordem: proxima, ativo: dados.ativo });
    }
    revalidatePath("/configuracoes");
    revalidatePath("/itens");
    return { ok: true };
  } catch {
    return { erro: "Já existe um material com esse nome." };
  }
}

export async function removerMaterial3d(id: string): Promise<Resultado> {
  await exigirAdmin();
  const emUso = await db
    .select({ itemId: itensParametros3d.itemId })
    .from(itensParametros3d)
    .where(eq(itensParametros3d.materialId, id))
    .limit(1);
  if (emUso.length > 0) {
    return { erro: "Existem itens impressos neste material. Desative-o em vez de remover." };
  }
  await db.delete(materiais3d).where(eq(materiais3d.id, id));
  revalidatePath("/configuracoes");
  revalidatePath("/itens");
  return { ok: true };
}

/* ------------------------------------------------------------ Usuários --- */

const esquemaUsuario = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(1, "Informe o nome"),
  email: z.email("E-mail inválido").transform((v) => v.toLowerCase()),
  papel: z.enum(["admin", "editor", "leitura"]),
  ativo: z.boolean(),
  /* Em branco na edicao significa "manter a senha atual". */
  senha: z.string(),
});

export async function salvarUsuario(dados: {
  id?: string;
  nome: string;
  email: string;
  papel: "admin" | "editor" | "leitura";
  ativo: boolean;
  senha: string;
}): Promise<Resultado> {
  const sessao = await exigirAdmin();

  const validado = esquemaUsuario.safeParse(dados);
  if (!validado.success) {
    return { erro: validado.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = validado.data;

  if (!d.id && d.senha.length < 6) {
    return { erro: "A senha precisa ter pelo menos 6 caracteres." };
  }
  if (d.senha && d.senha.length < 6) {
    return { erro: "A nova senha precisa ter pelo menos 6 caracteres." };
  }

  /* Trava de seguranca: o sistema nao pode ficar sem nenhum administrador
     ativo, senao ninguem consegue mais gerenciar acessos. */
  if (d.id && (d.papel !== "admin" || !d.ativo)) {
    const [{ admins }] = await db
      .select({ admins: sql<number>`count(*)::int` })
      .from(usuarios)
      .where(sql`${usuarios.papel} = 'admin' and ${usuarios.ativo} = true and ${usuarios.id} <> ${d.id}`);
    if (admins === 0) {
      return { erro: "Este é o último administrador ativo. Promova outra pessoa antes." };
    }
  }

  try {
    if (d.id) {
      await db
        .update(usuarios)
        .set({
          nome: d.nome,
          email: d.email,
          papel: d.papel,
          ativo: d.ativo,
          ...(d.senha ? { senhaHash: await bcrypt.hash(d.senha, 10) } : {}),
        })
        .where(eq(usuarios.id, d.id));
    } else {
      await db.insert(usuarios).values({
        nome: d.nome,
        email: d.email,
        papel: d.papel,
        ativo: d.ativo,
        senhaHash: await bcrypt.hash(d.senha, 10),
      });
    }

    await registrar({
      usuarioId: sessao.id,
      tabela: "usuarios",
      registroId: d.id ?? d.email,
      acao: d.id ? "atualizar" : "criar",
      /* Sem a senha, obviamente. */
      depois: { nome: d.nome, email: d.email, papel: d.papel, ativo: d.ativo },
    });

    revalidatePath("/configuracoes");
    return { ok: true };
  } catch {
    return { erro: "Já existe um usuário com esse e-mail." };
  }
}

/** Troca da propria senha — qualquer perfil pode, inclusive leitura. */
export async function trocarMinhaSenha(
  senhaAtual: string,
  novaSenha: string,
): Promise<Resultado> {
  const sessao = await sessaoAtual();
  if (!sessao) return { erro: "Sessão expirada. Entre de novo." };
  if (novaSenha.length < 6) return { erro: "A nova senha precisa ter pelo menos 6 caracteres." };

  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, sessao.id));
  if (!usuario) return { erro: "Usuário não encontrado." };

  if (!(await bcrypt.compare(senhaAtual, usuario.senhaHash))) {
    return { erro: "A senha atual está incorreta." };
  }

  await db
    .update(usuarios)
    .set({ senhaHash: await bcrypt.hash(novaSenha, 10) })
    .where(eq(usuarios.id, sessao.id));

  return { ok: true };
}
