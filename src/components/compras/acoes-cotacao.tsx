"use client";

import { FileCheck2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Selecao } from "@/components/ui/campo";
import { atualizarStatusCotacao, gerarPedidos } from "@/lib/acoes/compras";
import { opcoes, STATUS_COTACAO, type StatusCotacao } from "@/lib/labels";

export function AcoesCotacao({
  cotacaoId,
  status,
  temEscolhido,
}: {
  cotacaoId: string;
  status: StatusCotacao;
  temEscolhido: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const fechada = status === "fechada" || status === "cancelada";

  function gerar() {
    if (!confirm("Gerar os pedidos de compra e fechar esta cotação?\n\nUm pedido por fornecedor escolhido.")) {
      return;
    }
    iniciar(async () => {
      const r = await gerarPedidos(cotacaoId);
      if (r.erro) alert(r.erro);
      else {
        alert(`${r.pedidos} ${r.pedidos === 1 ? "pedido gerado" : "pedidos gerados"}.`);
        router.push("/compras/pedidos");
      }
    });
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
        <Botao onClick={gerar} disabled={pendente || !temEscolhido}>
          {pendente ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <FileCheck2 className="size-4" />
          )}
          Gerar pedidos
        </Botao>
      )}
    </div>
  );
}
