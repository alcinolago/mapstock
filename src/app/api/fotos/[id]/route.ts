import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { itemFotos } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";

/* Buffer do bytea: runtime node, nao edge. */
export const runtime = "nodejs";

/**
 * A foto do item, lida do banco.
 *
 * `?mini=1` devolve a miniatura — e o que a lista e o seletor pedem, para nao
 * baixar a foto inteira so para preencher um quadrado de 40px. As duas versoes
 * vem em colunas separadas, entao cada uma so le o que vai mandar.
 *
 * Cache eterno porque a linha e imutavel: trocar a foto de um item cria outro
 * id. Fica `private` de proposito — a rota esta atras da sessao (o proxy
 * bloqueia), e o conteudo nao deve ficar em cache compartilhado.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await exigirSessao();

  const { id } = await params;
  const mini = request.nextUrl.searchParams.get("mini") === "1";

  const [foto] = mini
    ? await db
        .select({ bytes: itemFotos.miniatura, tipo: itemFotos.tipo })
        .from(itemFotos)
        .where(eq(itemFotos.id, id))
    : await db
        .select({ bytes: itemFotos.dados, tipo: itemFotos.tipo })
        .from(itemFotos)
        .where(eq(itemFotos.id, id));

  if (!foto) return new Response("Foto não encontrada.", { status: 404 });

  return new Response(new Uint8Array(foto.bytes), {
    headers: {
      "Content-Type": foto.tipo,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
