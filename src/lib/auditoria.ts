import { db } from "@/db";
import { logAuditoria } from "@/db/schema";
import type { AcaoAuditoria } from "@/lib/labels";

/**
 * Registra quem mexeu no que. Com duas pessoas na mesma base do Neon, este
 * log e a unica forma de reconstruir o que aconteceu.
 *
 * Nunca derruba a operacao principal: se o log falhar, a gravacao do dado
 * ja aconteceu e perder a trilha e menos grave do que perder o registro.
 */
export async function registrar(entrada: {
  usuarioId: string;
  tabela: string;
  registroId: string;
  acao: AcaoAuditoria;
  antes?: unknown;
  depois?: unknown;
}) {
  try {
    await db.insert(logAuditoria).values({
      usuarioId: entrada.usuarioId,
      tabela: entrada.tabela,
      registroId: entrada.registroId,
      acao: entrada.acao,
      dadosAntes: entrada.antes ?? null,
      dadosDepois: entrada.depois ?? null,
    });
  } catch (e) {
    console.error("Falha ao gravar auditoria:", e);
  }
}
