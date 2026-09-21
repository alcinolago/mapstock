"use client";

import { FileCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Selecao } from "@/components/ui/campo";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { atualizarStatusCotacao, gerarPedidos } from "@/lib/acoes/compras";
import { opcoes, STATUS_COTACAO, type StatusCotacao } from "@/lib/labels";

export function AcoesCotacao({
  cotacaoId,
  status,
  pedidosPrevistos,
  itensPrevistos,
  semVencedor,
}: {
  cotacaoId: string;
  status: StatusCotacao;
  /** Quantos pedidos saem: um por fornecedor vencedor ainda nao comprado. */
  pedidosPrevistos: number;
  itensPrevistos: number;
  /** Codigos dos itens que ficam de fora por nao terem vencedor marcado. */
  semVencedor: string[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const fechada = status === "fechada" || status === "cancelada";

  async function gerar() {
    const r = await gerarPedidos(cotacaoId);
    if (r.erro) return r;
    router.push("/compras/pedidos");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Selecao
        value={status}
        disabled={pendente || fechada}
        onChange={(e) =>
          iniciar(async () => {
            await atualizarStatusCotacao(cotacaoId, e.target.value as StatusCotacao);
            router.refresh();
          })
        }
        className="h-9 w-auto min-w-36 text-xs"
        aria-label="Status da cotação"
      >
        {opcoes(STATUS_COTACAO).map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </Selecao>

      {!fechada && (
        <BotaoConfirmar
          rotulo="Gerar pedidos"
          Icone={FileCheck2}
          variante="primario"
          tom="marca"
          desabilitado={pendente || itensPrevistos === 0}
          titulo="Gerar pedidos de compra"
          rotuloConfirmar={
            pedidosPrevistos === 1 ? "Gerar o pedido" : `Gerar os ${pedidosPrevistos} pedidos`
          }
          aoConfirmar={gerar}
        >
          <p>
            Saem{" "}
            <strong className="font-semibold text-texto">
              {pedidosPrevistos} {pedidosPrevistos === 1 ? "pedido" : "pedidos"} com{" "}
              {itensPrevistos} {itensPrevistos === 1 ? "item" : "itens"}
            </strong>
            , um pedido por fornecedor escolhido, com os preços que venceram.
          </p>

          {/* O aviso é o ponto todo desta janela: item sem vencedor não vira
              linha de pedido, e antes ele sumia junto com a cotação fechada. */}
          {semVencedor.length > 0 ? (
            <>
              <p>
                <strong className="font-semibold text-alerta">
                  {semVencedor.length}{" "}
                  {semVencedor.length === 1 ? "item fica de fora" : "itens ficam de fora"}
                </strong>
                , sem fornecedor escolhido:
              </p>
              <ul className="codigo ml-4 list-disc text-xs text-texto-suave">
                {semVencedor.map((codigo) => (
                  <li key={codigo}>{codigo}</li>
                ))}
              </ul>
              <p className="text-texto-fraco">
                A cotação continua aberta com eles — dá para escolher o vencedor e gerar o
                resto depois, sem cotar de novo.
              </p>
            </>
          ) : (
            <p className="text-texto-fraco">
              Não sobra item: a cotação é fechada no mesmo passo e deixa de aceitar
              alteração de preço.
            </p>
          )}
        </BotaoConfirmar>
      )}
    </div>
  );
}
