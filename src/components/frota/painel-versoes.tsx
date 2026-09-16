"use client";

import { AlertCircle, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import type { Versao } from "@/db/consultas";
import { excluirVersao, salvarVersao, type EstadoVersao } from "@/lib/acoes/frota";
import { opcoes, TIPOS_VERSAO, type TipoVersao } from "@/lib/labels";
import { data } from "@/lib/utils";

/**
 * Cadastro de versões: o que roda no PC do carro e o que roda no tablet.
 *
 * São duas listas na mesma tabela, separadas pelo tipo — a numeração pode
 * repetir entre elas (o sistema 3.2 e o app 3.2 não têm nada a ver um com o
 * outro), e é por isso que o único é a dupla tipo + número.
 */
export function PainelVersoes({
  versoes,
  podeEditar,
}: {
  versoes: Versao[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [estado, acao, salvando] = useActionState<EstadoVersao, FormData>(salvarVersao, {});
  const [erro, setErro] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      formulario.current?.reset();
      router.refresh();
    }
  }, [estado.ok, router]);

  async function remover(v: Versao) {
    if (!confirm(`Excluir a versão ${v.numero}?`)) return;
    const r = await excluirVersao(v.id);
    if (r.erro) setErro(r.erro);
    else {
      setErro(null);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
      {podeEditar && (
        <Cartao className="h-fit">
          <CabecalhoCartao titulo="Nova versão" />
          <CorpoCartao>
            <form ref={formulario} action={acao} className="space-y-4">
              <Grupo rotulo="Tipo" obrigatorio htmlFor="tipo">
                <Selecao id="tipo" name="tipo" defaultValue="sistema" required>
                  {opcoes(TIPOS_VERSAO).map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </Grupo>

              <Grupo
                rotulo="Número"
                obrigatorio
                htmlFor="numero"
                erro={estado.campo === "numero" ? estado.erro : undefined}
              >
                <Entrada id="numero" name="numero" placeholder="Ex.: 3.14.2" required />
              </Grupo>

              <Grupo rotulo="Lançada em" htmlFor="lancadaEm">
                <Entrada id="lancadaEm" name="lancadaEm" type="date" />
              </Grupo>

              <Grupo rotulo="Notas" htmlFor="notas">
                <AreaTexto id="notas" name="notas" placeholder="O que mudou nesta versão" />
              </Grupo>

              {estado.erro && !estado.campo && (
                <p className="flex items-start gap-2 text-xs font-medium text-perigo">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {estado.erro}
                </p>
              )}

              <Botao type="submit" disabled={salvando} className="w-full">
                {salvando ? <LoaderCircle className="animate-spin" /> : <Plus />}
                Cadastrar versão
              </Botao>
            </form>
          </CorpoCartao>
        </Cartao>
      )}

      <Cartao className="overflow-hidden">
        <CabecalhoCartao
          titulo="Versões cadastradas"
          descricao="O número em uso em cada carro é escolhido no cadastro do carro."
        />

        {erro && (
          <p className="flex items-start gap-2 border-b border-borda bg-perigo-suave px-5 py-2 text-sm text-perigo">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        {versoes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-texto-fraco">
            Nenhuma versão cadastrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {versoes.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                <Selo tom={v.tipo === "sistema" ? "info" : "marca"}>
                  {TIPOS_VERSAO[v.tipo as TipoVersao]}
                </Selo>

                <span className="codigo shrink-0 text-sm font-semibold text-texto">
                  {v.numero}
                </span>

                <span className="min-w-0 flex-1 truncate text-xs text-texto-fraco">
                  {v.notas ?? ""}
                </span>

                {v.lancadaEm && (
                  <span className="shrink-0 text-xs whitespace-nowrap text-texto-fraco">
                    {data(v.lancadaEm)}
                  </span>
                )}

                <span className="shrink-0 text-xs whitespace-nowrap text-texto-suave">
                  {v.emUso} {v.emUso === 1 ? "carro" : "carros"}
                </span>

                {podeEditar && (
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    onClick={() => remover(v)}
                    title="Excluir versão"
                    aria-label={`Excluir versão ${v.numero}`}
                    className="px-1.5"
                  >
                    <Trash2 className="size-3.5 text-perigo" />
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
