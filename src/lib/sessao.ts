/**
 * Sessao propria: senha com bcrypt, JWT assinado com jose em cookie httpOnly.
 *
 * Por que nao uma biblioteca de auth pronta: sao duas ou tres pessoas usando
 * o sistema, e este arquivo inteiro cabe numa tela. Vale mais do que arrastar
 * um framework que muda de API a cada versao maior.
 *
 * Divisao importante: jose roda no middleware (runtime edge), bcryptjs nao.
 * Por isso o middleware so verifica a assinatura do token — conferir a senha
 * acontece na server action de login, que roda no Node.
 */
import { jwtVerify, SignJWT } from "jose";

import type { PapelUsuario } from "./labels";

export const COOKIE_SESSAO = "mapzer_sessao";
const DURACAO_HORAS = 12;

export type Sessao = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
};

function segredo(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "AUTH_SECRET nao definida. Gere uma com `openssl rand -base64 32` e coloque no .env.local.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function assinarSessao(sessao: Sessao): Promise<string> {
  return new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_HORAS}h`)
    .sign(segredo());
}

/** Retorna null para token ausente, adulterado ou expirado. */
export async function lerSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ["HS256"] });
    const { id, nome, email, papel } = payload as Record<string, unknown>;
    if (typeof id !== "string" || typeof nome !== "string" || typeof email !== "string") {
      return null;
    }
    return { id, nome, email, papel: papel as PapelUsuario };
  } catch {
    return null;
  }
}

export const opcoesCookie = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURACAO_HORAS * 60 * 60,
} as const;
