"use client";

import { AlertCircle, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { AlternarTema } from "@/components/layout/alternar-tema";
import { MarcaCompleta } from "@/components/layout/marca";
import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo } from "@/components/ui/campo";
import { entrar, type EstadoLogin } from "@/lib/acoes/sessao";

export function PaginaLogin({ destino }: { destino?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});
  const [verSenha, setVerSenha] = useState(false);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* Brilho sutil atras do cartao — mesma cor de marca nos dois temas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-14rem] left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-marca/10 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex items-center justify-between">
          <MarcaCompleta />
          <AlternarTema />
        </div>

        <div className="rounded-2xl border border-borda bg-superficie p-7 shadow-[var(--sombra)]">
          <h1 className="text-lg font-bold tracking-tight text-texto">Entrar</h1>
          <p className="mt-1 text-sm text-texto-fraco">
            Controle de estoque e compras da Mapzer.
          </p>

          <form action={acao} className="mt-6 space-y-4">
            <input type="hidden" name="destino" value={destino ?? ""} />

            <Grupo rotulo="E-mail" htmlFor="email" obrigatorio>
              <Entrada
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="voce@mapzer.com.br"
                required
                autoFocus
              />
            </Grupo>

            <Grupo rotulo="Senha" htmlFor="senha" obrigatorio>
              <div className="relative">
                <Entrada
                  id="senha"
                  name="senha"
                  type={verSenha ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-texto-fraco transition-colors hover:text-texto"
                >
                  {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Grupo>

            {estado.erro && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {estado.erro}
              </p>
            )}

            <Botao type="submit" tamanho="lg" disabled={pendente} className="w-full">
              {pendente && <LoaderCircle className="size-4 animate-spin" />}
              {pendente ? "Entrando..." : "Entrar"}
            </Botao>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-texto-fraco">
          Esqueceu a senha? Peça para um administrador redefinir.
        </p>
      </div>
    </main>
  );
}
