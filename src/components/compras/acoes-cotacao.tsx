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
  temEscolhido,
}: {
  cotacaoId: string;
  status: StatusCotacao;
  temEscolhido: boolean;
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
          desabilitado={pendente || !temEscolhido}
          titulo="Gerar pedidos de compra"
          rotuloConfirmar="Gerar e fechar"
          aoConfirmar={gerar}
        >
          <p>
            Sai um pedido por fornecedor escolhido no comparativo, com os itens e os preços
            que venceram.
          </p>
          <p className="text-texto-fraco">
            A cotação é fechada no mesmo passo e deixa de aceitar alteração de preço.
          </p>
        </BotaoConfirmar>
      )}
    </div>
  );
}
