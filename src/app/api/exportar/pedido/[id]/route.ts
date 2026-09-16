import type { NextRequest } from "next/server";

import { pedidoCompleto } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";
import { montarPdfDoPedido } from "@/lib/pdf-pedido";

/* pdf-lib monta o arquivo inteiro na memoria: runtime node, nao edge. */
export const runtime = "nodejs";

/** O PDF do pedido, para mandar para quem vai comprar. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await exigirSessao();

  const { id } = await params;
  const dados = await pedidoCompleto(id);

  if (!dados) return new Response("Pedido não encontrado.", { status: 404 });

  const { bytes, arquivo } = await montarPdfDoPedido(dados);

  /* visualizar=1 abre no navegador em vez de baixar — util para conferir a
     folha antes de mandar. */
  const inline = request.nextUrl.searchParams.get("visualizar") === "1";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
