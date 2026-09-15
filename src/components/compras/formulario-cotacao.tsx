"use client";

import { AlertCircle, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import { criarCotacao, type EstadoCotacao } from "@/lib/acoes/compras";
import { cn } from "@/lib/utils";

type Origem = "vazia" | "abaixo_minimo" | "estrutura";

const ORIGENS: { valor: Origem; titulo: string; descricao: string }[] = [
  {
    valor: "abaixo_minimo",
    titulo: "Repor o que está faltando",
    descricao: "Traz todos os itens em falta ou abaixo do mínimo, já com a quantidade sugerida.",
  },
  {
    valor: "estrutura",
    titulo: "Montar um equipamento",
    descricao: "Explode a estrutura e traz todas as peças que entram na montagem.",
  },
  {
    valor: "vazia",
    titulo: "Começar do zero",
    descricao: "Cotação vazia — você adiciona os itens um a um.",
  },
];

export function FormularioCotacao({
  equipamentos,
  qtdEmFalta,
}: {
  equipamentos: { id: string; codigo: string; descricao: string }[];
  qtdEmFalta: number;
}) {
  const router = useRouter();
  const [estado, acao, enviando] = useActionState<EstadoCotacao, FormData>(criarCotacao, {});
  const [origem, setOrigem] = useState<Origem>(qtdEmFalta > 0 ? "abaixo_minimo" : "vazia");

  useEffect(() => {
    if (estado.ok && estado.id) router.push(`/compras/cotacoes/${estado.id}`);
  }, [estado.ok, estado.id, router]);

  return (
    <form action={acao} className="space-y-5">
      <Cartao>
        <CabecalhoCartao titulo="Nova cotação" />
        <CorpoCartao className="space-y-4">
          <Grupo rotulo="Título" obrigatorio htmlFor="titulo">
            <Entrada
              id="titulo"
              name="titulo"
              placeholder="Ex.: Reposição de fixadores — outubro"
              required
              autoFocus
            />
          </Grupo>

          <Grupo rotulo="Observações" htmlFor="observacoes">
            <AreaTexto id="observacoes" name="observacoes" rows={2} />
          </Grupo>
        </CorpoCartao>
      </Cartao>

      <Cartao>
        <CabecalhoCartao
          titulo="Quais itens entram"
          descricao="Você pode ajustar a lista depois, na tela da cotação."
        />
        <CorpoCartao className="space-y-2">
          <input type="hidden" name="origem" value={origem} />

          {ORIGENS.map((o) => {
            const desabilitada =
              (o.valor === "abaixo_minimo" && qtdEmFalta === 0) ||
              (o.valor === "estrutura" && equipamentos.length === 0);

            return (
              <label
                key={o.valor}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                  origem === o.valor
                    ? "border-marca bg-marca-suave/40"
                    : "border-borda hover:bg-superficie-2",
                  desabilitada && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  checked={origem === o.valor}
                  onChange={() => setOrigem(o.valor)}
                  disabled={desabilitada}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--marca)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-texto">
                    {o.titulo}
                    {o.valor === "abaixo_minimo" && qtdEmFalta > 0 && (
                      <span className="ml-2 font-normal text-marca">
                        {qtdEmFalta} {qtdEmFalta === 1 ? "item" : "itens"}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-texto-fraco">{o.descricao}</span>
                </span>
              </label>
            );
          })}

          {origem === "estrutura" && (
            <div className="grid gap-4 pt-2 sm:grid-cols-[1fr_8rem]">
              <Grupo rotulo="Equipamento" obrigatorio htmlFor="raizId">
                <Selecao id="raizId" name="raizId" required>
                  <option value="">Selecione...</option>
                  {equipamentos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo} — {e.descricao}
                    </option>
                  ))}
                </Selecao>
              </Grupo>
              <Grupo rotulo="Quantas unidades" htmlFor="multiplicador">
                <Entrada
                  id="multiplicador"
                  name="multiplicador"
                  inputMode="decimal"
                  defaultValue="1"
                  className="num"
                />
              </Grupo>
            </div>
          )}
        </CorpoCartao>
      </Cartao>

      {estado.erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-perigo-suave px-4 py-3 text-sm font-medium text-perigo"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {estado.erro}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <Botao type="button" variante="suave" onClick={() => router.push("/compras/cotacoes")}>
          Cancelar
        </Botao>
        <Botao type="submit" tamanho="lg" disabled={enviando}>
          {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {enviando ? "Criando..." : "Criar cotação"}
        </Botao>
      </div>
    </form>
  );
}
