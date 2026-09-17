"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, PlusCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { SeletorItem, type ItemBusca } from "./seletor-item";
import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoNumero } from "@/components/ui/campo-mascarado";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import { lancarMovimento, type EstadoMovimento } from "@/lib/acoes/estoque";
import { EFEITO_MOVIMENTO, MOVIMENTOS, opcoes, type TipoMovimento } from "@/lib/labels";
import { numero } from "@/lib/utils";

export function FormularioMovimento({ itens }: { itens: ItemBusca[] }) {
  const [estado, acao, enviando] = useActionState<EstadoMovimento, FormData>(
    lancarMovimento,
    {},
  );
  const [itemId, setItemId] = useState<string>();
  const [tipo, setTipo] = useState<TipoMovimento>("entrada_compra");
  const [chave, setChave] = useState(0);
  const [tratado, setTratado] = useState<EstadoMovimento | null>(null);

  const escolhido = itens.find((i) => i.id === itemId);
  const efeito = EFEITO_MOVIMENTO[tipo];
  const reduzSaldo = efeito.fisico === -1 || efeito.reservado === 1;

  /* Depois de lancar, limpa o formulario mas mantem o tipo: quem esta dando
     entrada numa nota costuma lancar varios itens seguidos do mesmo jeito.
     O ajuste acontece durante o render, comparando a identidade do estado
     que a action devolveu — cada retorno e um objeto novo. */
  if (estado.ok && estado !== tratado) {
    setTratado(estado);
    setItemId(undefined);
    setChave((k) => k + 1);
  }

  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Lançar movimentação"
        descricao="Entradas somam, saídas subtraem, reservas separam sem tirar do estoque."
      />
      <CorpoCartao>
        <form action={acao} key={chave} className="space-y-4">
          <Grupo rotulo="Item" obrigatorio>
            <SeletorItem itens={itens} valor={itemId} aoEscolher={setItemId} />
          </Grupo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Grupo rotulo="Tipo" obrigatorio htmlFor="tipo">
              <Selecao
                id="tipo"
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoMovimento)}
                required
              >
                {opcoes(MOVIMENTOS).map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </Selecao>
            </Grupo>

            <Grupo
              rotulo="Quantidade"
              obrigatorio
              htmlFor="quantidade"
              ajuda={
                escolhido
                  ? `Disponível hoje: ${numero(escolhido.disponivel)} ${escolhido.unidade}`
                  : undefined
              }
            >
              <CampoNumero id="quantidade" name="quantidade" padrao="1" required />
            </Grupo>

            <Grupo rotulo="Referência" htmlFor="referencia">
              <Entrada
                id="referencia"
                name="referencia"
                placeholder="Nota fiscal, ordem, equipamento..."
              />
            </Grupo>

            <Grupo rotulo="Observação" htmlFor="observacao">
              <Entrada id="observacao" name="observacao" />
            </Grupo>
          </div>

          {reduzSaldo && (
            <label className="flex items-center gap-2 text-xs text-texto-suave">
              <input
                type="checkbox"
                name="permitirNegativo"
                className="size-4 accent-[var(--marca)]"
              />
              Permitir saldo negativo (uso em acerto de inventário)
            </label>
          )}

          {estado.erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {estado.erro}
            </p>
          )}

          {estado.ok && estado.aviso && (
            <p className="flex items-start gap-2 rounded-lg bg-ok-suave px-3 py-2.5 text-sm font-medium text-ok">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {estado.aviso}
            </p>
          )}

          <Botao
            type="submit"
            variante="movimento"
            className="w-full"
            disabled={enviando || !itemId}
          >
            {enviando ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <PlusCircle className="size-4" />
            )}
            {enviando ? "Lançando..." : "Lançar movimentação"}
          </Botao>
        </form>
      </CorpoCartao>
    </Cartao>
  );
}
