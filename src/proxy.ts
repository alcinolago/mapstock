import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

/**
 * Convencao `proxy` do Next 16 (era `middleware` ate o 15).
 *
 * Bloqueia tudo que nao for /login. So confere a assinatura do token — a
 * checagem de papel fica nas paginas e nas server actions, que tem acesso
 * ao banco.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessao = await lerSessao(request.cookies.get(COOKIE_SESSAO)?.value);

  if (pathname === "/login") {
    if (sessao) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!sessao) {
    const login = new URL("/login", request.url);
    /* Guarda pra onde a pessoa queria ir, pra devolver depois de entrar. */
    if (pathname !== "/") login.searchParams.set("destino", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
