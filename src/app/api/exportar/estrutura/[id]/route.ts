import type { NextRequest } from "next/server";

import { exigirSessao } from "@/lib/auth";
import { listarEstruturas } from "@/lib/estrutura";
import { montarPdfDaEstrutura } from "@/lib/pdf-estrutura";

/* pdf-lib monta o arquivo inteiro na memoria: runtime node, nao edge. */
export const runtime = "nodejs";

/** A estrutura em PDF, com a arvore inteira aberta, para levar para a bancada. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirSessao();

  const { id } = await params;
  /* Todas, e nao so esta: abrir um conjunto que entra como peca precisa da
     arvore do outro molde, e e listarEstruturas que sabe fazer isso. */
  const molde = (await listarEstruturas()).find((m) => m.id === id);

  if (!molde) return new Response("Estrutura não encontrada.", { status: 404 });

  const { bytes, arquivo } = await montarPdfDaEstrutura(molde, sessao.nome);

  /* visualizar=1 abre no navegador em vez de baixar — e o que o botao
     Imprimir usa, para a impressao sair pelo leitor de PDF. */
  const inline = request.nextUrl.searchParams.get("visualizar") === "1";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
