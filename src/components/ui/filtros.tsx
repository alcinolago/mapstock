"use client";

import { Search, X } from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

/**
 * A mecanica comum dos filtros: todos andam na URL, nenhum em estado de tela.
 *
 * Vai na URL porque todos correm na consulta — a listagem chega paginada, e
 * peneirar no navegador so olharia a pagina que ja veio. E porque recarregar,
 * voltar de um item e mandar o link precisam cair no mesmo lugar.
 */
export function useFiltrosUrl() {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const ir = useCallback(
    (novos: URLSearchParams) => {
      const busca = novos.toString();
      iniciar(() => router.replace(busca ? `${caminho}?${busca}` : caminho, { scroll: false }));
    },
    [caminho, router],
  );

  const aplicar = useCallback(
    (mudancas: Record<string, string>) => {
      const novos = new URLSearchParams(params);
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor) novos.set(chave, valor);
        else novos.delete(chave);
      }
      /* Mexer em filtro volta para a primeira pagina: a pagina 7 do resultado
         antigo nao e a pagina 7 do novo, e quem acabou de filtrar quer ver o
         comeco do que sobrou. */
      novos.delete("pagina");
      ir(novos);
    },
    [params, ir],
  );

  const limpar = useCallback(() => ir(new URLSearchParams()), [ir]);

  return { params, aplicar, limpar, pendente };
}

/**
 * Campo de texto que so vai a URL depois que a pessoa para de digitar.
 *
 * Sem a espera, cada tecla vira uma consulta. E o campo acompanha a URL
 * quando ela muda por fora — limpar filtros ou voltar no navegador tem de
 * esvaziar o que esta escrito, senao a espera reaplicaria o texto antigo.
 */
export function useBuscaComEspera(
  params: ReadonlyURLSearchParams,
  aplicar: (mudancas: Record<string, string>) => void,
  chave = "busca",
): [string, (valor: string) => void] {
  const naUrl = params.get(chave) ?? "";
  const [texto, setTexto] = useState(naUrl);
  /* O ultimo valor que a URL e o campo tiveram em comum. E ele que separa
     "a pessoa digitou" de "a URL mudou por fora". */
  const ultimo = useRef(naUrl);

  useEffect(() => {
    if (naUrl === ultimo.current) return;
    ultimo.current = naUrl;
    setTexto(naUrl);
  }, [naUrl]);

  useEffect(() => {
    if (texto === ultimo.current) return;
    const t = setTimeout(() => {
      ultimo.current = texto;
      aplicar({ [chave]: texto });
    }, 350);
    return () => clearTimeout(t);
  }, [texto, chave, aplicar]);

  return [texto, setTexto];
}

/** Entrada de busca com a lupa dentro. */
export function CampoBusca({
  valor,
  aoMudar,
  placeholder,
  rotulo,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder: string;
  rotulo: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-52 flex-1", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-fraco" />
      <Entrada
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        className="pl-9"
      />
    </div>
  );
}

/** O botao de limpar, que so aparece quando ha o que limpar. */
export function BotaoLimpar({ aoLimpar }: { aoLimpar: () => void }) {
  return (
    <Botao variante="suave" tamanho="sm" onClick={aoLimpar}>
      <X className="size-3.5" />
      Limpar
    </Botao>
  );
}

/** "Filtrando..." ao lado dos campos enquanto a consulta nao volta. */
export function AvisoFiltrando({ pendente }: { pendente: boolean }) {
  if (!pendente) return null;
  return <span className="text-xs text-texto-fraco">Filtrando...</span>;
}
