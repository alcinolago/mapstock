import { ShieldCheck } from "lucide-react";

import { TrocarSenha } from "@/components/configuracoes/trocar-senha";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth";
import { PAPEIS } from "@/lib/labels";

export const metadata = { title: "Minha conta" };

/**
 * Página de conta de qualquer pessoa logada, inclusive quem é só leitura.
 *
 * Trocar a própria senha não pode morar em Configurações: aquela tela é
 * restrita a administrador, e trancar ali deixaria o resto da equipe sem
 * como mudar a senha que recebeu de outra pessoa.
 */
export default async function PaginaConta() {
  const sessao = await exigirSessao();

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina titulo="Minha conta" descricao="Seus dados de acesso ao MapStock." />

      <div className="space-y-5">
        <Cartao>
          <CabecalhoCartao titulo="Dados" />
          <CorpoCartao className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-texto-suave">Nome</p>
              <p className="mt-1 text-sm text-texto">{sessao.nome}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-texto-suave">E-mail</p>
              <p className="mt-1 text-sm text-texto">{sessao.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-texto-suave">Perfil</p>
              <p className="mt-1">
                <Selo tom={sessao.papel === "admin" ? "marca" : "neutro"}>
                  {PAPEIS[sessao.papel]}
                </Selo>
              </p>
            </div>
          </CorpoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao
            titulo="Trocar senha"
            descricao="Se você recebeu uma senha de outra pessoa, troque na primeira vez que entrar."
          />
          <CorpoCartao>
            <TrocarSenha />
          </CorpoCartao>
        </Cartao>

        <p className="flex items-start gap-2 rounded-lg bg-superficie-2 px-4 py-3 text-xs text-texto-fraco">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Para alterar nome, e-mail ou perfil, peça a um administrador. Esqueceu a senha? Um
          administrador consegue redefinir em Configurações.
        </p>
      </div>
    </div>
  );
}
