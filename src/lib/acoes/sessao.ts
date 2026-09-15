"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { assinarSessao, COOKIE_SESSAO, opcoesCookie } from "@/lib/sessao";

const esquemaLogin = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
  destino: z.string().optional(),
});

export type EstadoLogin = { erro?: string };

export async function entrar(
  _estado: EstadoLogin,
  formulario: FormData,
): Promise<EstadoLogin> {
  const dados = esquemaLogin.safeParse({
    email: formulario.get("email"),
    senha: formulario.get("senha"),
    destino: formulario.get("destino"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { email, senha, destino } = dados.data;
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email.toLowerCase()));

  /* Mensagem unica para e-mail inexistente e senha errada: nao entrega
     quais e-mails estao cadastrados. O bcrypt roda mesmo sem usuario para
     o tempo de resposta nao denunciar a diferenca. */
  const hash =
    usuario?.senhaHash ?? "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  const confere = await bcrypt.compare(senha, hash);

  if (!usuario || !confere) {
    return { erro: "E-mail ou senha incorretos." };
  }
  if (!usuario.ativo) {
    return { erro: "Este acesso está desativado. Fale com o administrador." };
  }

  const token = await assinarSessao({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  });

  (await cookies()).set(COOKIE_SESSAO, token, opcoesCookie);

  const rota = destino && destino.startsWith("/") ? destino : "/";
  redirect(rota);
}

export async function sair() {
  (await cookies()).delete(COOKIE_SESSAO);
  redirect("/login");
}
