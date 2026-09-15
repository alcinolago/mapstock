/** Leitura da sessao do lado do servidor (Server Components e Server Actions). */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_SESSAO, lerSessao, type Sessao } from "./sessao";

export async function sessaoAtual(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  return lerSessao(token);
}

/** Usa em qualquer pagina interna: garante sessao ou manda pro login. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");
  return sessao;
}

/** Usa nas server actions que escrevem: perfil "leitura" nao pode alterar. */
export async function exigirEdicao(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel === "leitura") {
    throw new Error("Seu perfil é somente leitura e não pode fazer alterações.");
  }
  return sessao;
}

export async function exigirAdmin(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== "admin") {
    throw new Error("Apenas administradores podem acessar esta área.");
  }
  return sessao;
}
