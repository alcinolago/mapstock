"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Selecao } from "@/components/ui/campo";
import { numerosDePagina, POR_PAGINA } from "@/lib/paginacao";
import { cn, numero } from "@/lib/utils";

/**
 * Rodape de paginacao. Anda pela URL, como os filtros — assim recarregar,
 * voltar de um item e mandar o link caem todos na mesma pagina.
 */
export function Paginacao({
  pagina,
  porPagina,
  total,
  oQue,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  /** Plural do que esta sendo contado: "itens", "movimentações". */
  oQue: string;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const ultima = Math.max(1, Math.ceil(total / porPagina));
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  function ir(mudancas: Record<string, string>) {
    const novos = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novos.set(chave, valor);
      else novos.delete(chave);
    }
    iniciar(() => router.replace(`${caminho}?${novos}`, { scroll: false }));
  }

  /* Trocar o tamanho volta para a primeira: manter a pagina 7 ao passar de
     25 para 200 jogaria a pessoa num trecho que ela nao estava vendo. */
  const trocarTamanho = (valor: string) => ir({ porPagina: valor, pagina: "" });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borda px-4 py-3 text-xs">
      <span className="text-texto-fraco">
        {total === 0 ? (
          `Nenhum resultado`
        ) : (
          <>
            <span className="num font-semibold text-texto">
              {numero(primeiro)}–{numero(ultimo)}
            </span>{" "}
            de <span className="num font-semibold text-texto">{numero(total)}</span> {oQue}
          </>
        )}
        {pendente && <span className="ml-2">carregando...</span>}
      </span>

      <div className="flex items-center gap-2">
        <Selecao
          value={String(porPagina)}
          onChange={(e) => trocarTamanho(e.target.value)}
          className="h-8 w-auto text-xs"
          aria-label="Linhas por página"
        >
          {POR_PAGINA.map((n) => (
            <option key={n} value={n}>
              {n} por página
            </option>
          ))}
        </Selecao>

        {ultima > 1 && (
          <nav className="flex items-center gap-1" aria-label="Paginação">
            <Passo
              rotulo="Página anterior"
              desabilitado={pagina <= 1}
              aoClicar={() => ir({ pagina: String(pagina - 1) })}
            >
              <ChevronLeft className="size-4" />
            </Passo>

            {numerosDePagina(pagina, ultima).map((n, i) =>
              n === null ? (
                <span key={`corte-${i}`} className="px-1 text-texto-fraco">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => ir({ pagina: n === 1 ? "" : String(n) })}
                  aria-current={n === pagina ? "page" : undefined}
                  className={cn(
                    "num grid h-8 min-w-8 place-items-center rounded-lg px-2 font-semibold transition-colors",
                    n === pagina
                      ? "bg-marca text-marca-texto"
                      : "text-texto-suave hover:bg-superficie-2 hover:text-texto",
                  )}
                >
                  {n}
                </button>
              ),
            )}

            <Passo
              rotulo="Próxima página"
              desabilitado={pagina >= ultima}
              aoClicar={() => ir({ pagina: String(pagina + 1) })}
            >
              <ChevronRight className="size-4" />
            </Passo>
          </nav>
        )}
      </div>
    </div>
  );
}

function Passo({
  rotulo,
  desabilitado,
  aoClicar,
  children,
}: {
  rotulo: string;
  desabilitado: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      className="grid size-8 place-items-center rounded-lg text-texto-suave transition-colors hover:bg-superficie-2 hover:text-texto disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
