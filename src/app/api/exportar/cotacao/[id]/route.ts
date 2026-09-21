import type { NextRequest } from "next/server";

import { cotacaoParaPdf } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";
import { montarPdfDaCotacao } from "@/lib/pdf-cotacao";

/* pdf-lib monta o arquivo inteiro na memoria: runtime node, nao edge. */
export const runtime = "nodejs";

/**
 * A solicitacao de cotacao em PDF, para mandar aos fornecedores.
 *
 * O mesmo arquivo vai para varios ao mesmo tempo, entao ele nao carrega nome
 * de fornecedor nem valor nenhum — quem garante isso e a consulta
 * `cotacaoParaPdf`, que so devolve o que descreve a peca.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await exigirSessao();

  const { id } = await params;
  const dados = await cotacaoParaPdf(id);

  if (!dados) return new Response("Cotação não encontrada.", { status: 404 });

  const { bytes, arquivo } = await montarPdfDaCotacao(dados);

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
