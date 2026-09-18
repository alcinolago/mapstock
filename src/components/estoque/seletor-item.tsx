"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Entrada } from "@/components/ui/campo";
import { Selo } from "@/components/ui/selo";
import { cn, numero } from "@/lib/utils";

export type ItemBusca = {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  disponivel: number;
  /** So quem precisa exibir o papel na estrutura preenche. */
  papel?: number;
};

/**
 * Busca de item por codigo ou descricao, no espirito do SuggestList do
 * desktop: digita, filtra, escolhe. Mostra o disponivel ao lado, que e a
 * informacao que a pessoa precisa exatamente na hora de lancar movimento.
 */
export function SeletorItem({
  itens,
  valor,
  aoEscolher,
  nome = "itemId",
  placeholder = "Buscar item por código ou descrição...",
  /* Quando vem, o papel do item aparece num selo ao lado do codigo. A
     estrutura precisa disso: ali o papel e que decide o que pode entrar. */
  nomePapel,
}: {
  itens: ItemBusca[];
  valor?: string;
  aoEscolher: (id: string) => void;
  nome?: string;
  placeholder?: string;
  nomePapel?: (num: number) => string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  const escolhido = itens.find((i) => i.id === valor);

  const filtrados = useMemo(() => {
    const t = busca.trim().toUpperCase();
    if (!t) return itens.slice(0, 50);
    return itens
      .filter((i) => i.codigo.toUpperCase().includes(t) || i.descricao.toUpperCase().includes(t))
      .slice(0, 50);
  }, [busca, itens]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <input type="hidden" name={nome} value={valor ?? ""} />

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-borda-forte bg-superficie px-3 text-left text-sm transition-colors hover:border-marca/50"
      >
        {escolhido ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="codigo shrink-0 text-xs font-semibold text-marca">
              {escolhido.codigo}
            </span>
            <span className="min-w-0 flex-1 truncate text-texto">{escolhido.descricao}</span>
            {nomePapel && escolhido.papel !== undefined && (
              <Selo tom="neutro">{nomePapel(escolhido.papel)}</Selo>
            )}
          </span>
        ) : (
          <span className="text-texto-fraco">{placeholder}</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 text-texto-fraco" />
      </button>

      {aberto && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-borda bg-superficie shadow-lg">
          <div className="relative border-b border-borda p-2">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-texto-fraco" />
            <Entrada
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite para filtrar"
              className="pl-9"
              autoFocus
            />
          </div>

          <ul role="listbox" className="rolagem-fina max-h-72 overflow-y-auto p-1">
            {filtrados.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-texto-fraco">
                Nenhum item encontrado.
              </li>
            ) : (
              filtrados.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i.id === valor}
                    onClick={() => {
                      aoEscolher(i.id);
                      setAberto(false);
                      setBusca("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                      i.id === valor ? "bg-marca-suave" : "hover:bg-superficie-2",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0 text-marca",
                        i.id === valor ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="codigo block text-xs font-semibold text-marca">
                        {i.codigo}
                      </span>
                      <span className="block truncate text-xs text-texto-suave">
                        {i.descricao}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "num shrink-0 text-xs font-semibold",
                        i.disponivel > 0 ? "text-texto-suave" : "text-perigo",
                      )}
                    >
                      {numero(i.disponivel)} {i.unidade}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
