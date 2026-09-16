"use client";

import { FileDown, Loader2, Share2 } from "lucide-react";
import { useState } from "react";

import { Botao, botao } from "@/components/ui/botao";

/**
 * Baixar e compartilhar o PDF do pedido.
 *
 * O download e um link comum de proposito: funciona sem JavaScript, o
 * navegador cuida do arquivo e a pessoa nao fica esperando nada na tela.
 *
 * Compartilhar e o que resolve o caminho real — o PDF precisa chegar em quem
 * compra, quase sempre por WhatsApp. No celular e no tablet o proprio sistema
 * abre a lista de aplicativos com o arquivo anexado. No desktop isso nao
 * existe: nenhum navegador deixa uma pagina anexar arquivo no WhatsApp Web,
 * entao o melhor possivel e baixar o PDF e abrir a conversa com o texto
 * pronto, para a pessoa so arrastar o arquivo.
 */
export function AcoesPedido({
  pedidoId,
  numero,
  fornecedor,
  totalItens,
  total,
}: {
  pedidoId: string;
  numero: string;
  fornecedor: string;
  totalItens: number;
  total: string;
}) {
  const [compartilhando, setCompartilhando] = useState(false);
  const endereco = `/api/exportar/pedido/${pedidoId}`;

  const texto = [
    `Pedido de compra ${numero}`,
    `Fornecedor: ${fornecedor}`,
    `${totalItens} ${totalItens === 1 ? "item" : "itens"} · total estimado ${total}`,
    "O PDF traz o link de cada produto e o que escolher no site.",
  ].join("\n");

  async function compartilhar() {
    setCompartilhando(true);
    try {
      const resposta = await fetch(endereco);
      if (!resposta.ok) throw new Error("Não foi possível gerar o PDF agora.");

      const nome = `pedido_${numero}.pdf`;
      const arquivo = new File([await resposta.blob()], nome, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({
          files: [arquivo],
          title: `Pedido ${numero} — ${fornecedor}`,
          text: texto,
        });
        return;
      }

      const url = URL.createObjectURL(arquivo);
      const ancora = document.createElement("a");
      ancora.href = url;
      ancora.download = nome;
      ancora.click();
      URL.revokeObjectURL(url);

      window.open(
        `https://web.whatsapp.com/send?text=${encodeURIComponent(texto)}`,
        "_blank",
        "noopener",
      );
    } catch (erro) {
      /* Fechar a janela de compartilhamento vira AbortError: nao e erro. */
      if ((erro as Error)?.name !== "AbortError") {
        alert((erro as Error)?.message ?? "Não foi possível compartilhar o pedido.");
      }
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <>
      <a href={endereco} className={botao({ variante: "contorno", tamanho: "md" })}>
        <FileDown />
        Baixar PDF
      </a>

      <Botao variante="primario" onClick={compartilhar} disabled={compartilhando}>
        {compartilhando ? <Loader2 className="animate-spin" /> : <Share2 />}
        Compartilhar
      </Botao>
    </>
  );
}
