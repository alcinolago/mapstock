"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campo";

export function FiltrosItens({
  classificacoes,
  itens,
  locais,
}: {
  classificacoes: { id: string; nome: string }[];
  /** Todo o cadastro, para escolher pelo codigo sem digitar. */
  itens: { id: string; codigo: string; ativo: boolean }[];
  locais: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const [busca, setBusca] = useState(params.get("busca") ?? "");

  function aplicar(chave: string, valor: string) {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    iniciar(() => router.replace(`${caminho}?${novos}`, { scroll: false }));
  }

  /* Busca com espera: nao dispara uma consulta por tecla digitada. */
  useEffect(() => {
    const atual = params.get("busca") ?? "";
    if (busca === atual) return;
    const t = setTimeout(() => aplicar("busca", busca), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const temFiltro = ["busca", "classificacao", "situacao", "item", "local"].some((c) =>
    params.get(c),
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-fraco" />
        <Entrada
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, descrição ou localização"
          aria-label="Buscar itens"
          className="pl-9"
        />
      </div>

      <Selecao
        aria-label="Código do item"
        value={params.get("item") ?? ""}
        onChange={(e) => aplicar("item", e.target.value)}
        className="codigo w-auto min-w-36"
      >
        <option value="">Todos os códigos</option>
        {itens.map((i) => (
          <option key={i.id} value={i.id}>
            {i.codigo}
            {i.ativo ? "" : " (inativo)"}
          </option>
        ))}
      </Selecao>

      <Selecao
        aria-label="Classificação"
        value={params.get("classificacao") ?? ""}
        onChange={(e) => aplicar("classificacao", e.target.value)}
        className="w-auto min-w-40"
      >
        <option value="">Todas as classificações</option>
        {classificacoes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Selecao>


      <Selecao
        aria-label="Local"
        value={params.get("local") ?? ""}
        onChange={(e) => aplicar("local", e.target.value)}
        className="w-auto min-w-40"
      >
        <option value="">Todos os locais</option>
        {locais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </Selecao>

      <Selecao
        aria-label="Situação"
        value={params.get("situacao") ?? ""}
        onChange={(e) => aplicar("situacao", e.target.value)}
        className="w-auto min-w-36"
      >
        <option value="">Todas as situações</option>
        <option value="ok">OK</option>
        <option value="falta">Em falta</option>
        <option value="abaixo_minimo">Abaixo do mínimo</option>
      </Selecao>

      {temFiltro && (
        <Botao
          variante="suave"
          tamanho="sm"
          onClick={() => {
            setBusca("");
            iniciar(() => router.replace(caminho, { scroll: false }));
          }}
        >
          <X className="size-3.5" />
          Limpar
        </Botao>
      )}

      {pendente && <span className="text-xs text-texto-fraco">Filtrando...</span>}
    </div>
  );
}
