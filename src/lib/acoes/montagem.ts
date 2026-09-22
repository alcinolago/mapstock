"use server";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { saldos } from "@/db/consultas";
import { itens, moldeNos, moldes, montagemNos, montagens, movimentos, unidades } from "@/db/schema";
import { exigirEdicao, exigirSessao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";

/**
 * Montagem: o evento que transforma peças num item pronto.
 *
 * Só conjunto se monta — molde com `itemId`. O manual do equipamento completo não
 * passa por aqui: ele é documentação de bancada, não produz nada e não
 * encosta no estoque.
 *
 * Cada montagem vale por UMA unidade e fecha de uma vez só. Seis domos são
 * seis montagens: cada uma confere o estoque no momento do próprio clique, e
 * quem clicar primeiro leva as peças. Não existe reserva nem fila — foi
 * decisão explícita de quem monta, que prefere a bancada mandar na ordem.
 *
 * Abrir copia a árvore do molde para dentro da montagem. A cópia não é
 * otimização: editar a receita amanhã não pode reescrever com o que aquela
 * unidade foi feita ontem.
 */

export type FaltaNaMontagem = {
  itemId: string;
  nome: string;
  necessario: number;
  disponivel: number;
  unidade: string | null;
};

export type ResultadoMontagem = {
  erro?: string;
  faltando?: FaltaNaMontagem[];
  ok?: boolean;
};

/** Número sequencial por ano, no mesmo formato das cotações e pedidos. */
async function proximoNumero(): Promise<string> {
  const inicio = `MNT-${new Date().getFullYear()}-`;
  const [linha] = await db
    .select({ numero: montagens.numero })
    .from(montagens)
    .where(sql`${montagens.numero} like ${inicio + "%"}`)
    .orderBy(desc(montagens.numero))
    .limit(1);

  const ultimo = linha ? Number(linha.numero.slice(inicio.length)) : 0;
  return `${inicio}${String(ultimo + 1).padStart(4, "0")}`;
}

/**
 * Abre uma montagem de um conjunto. Não encosta no estoque: abrir é planejar, e
 * vale mesmo sem ter nenhuma peça na prateleira.
 */
export async function abrirMontagem(moldeId: string): Promise<{ erro?: string; numero?: string }> {
  const sessao = await exigirEdicao();

  const [molde] = await db.select().from(moldes).where(eq(moldes.id, moldeId));
  if (!molde) return { erro: "Estrutura não encontrada." };
  if (!molde.itemId) {
    return {
      erro: `${molde.nome} é o manual de um equipamento completo, não um item. Só item se monta.`,
    };
  }

  const receita = await db
    .select()
    .from(moldeNos)
    .where(eq(moldeNos.moldeId, moldeId))
    .orderBy(asc(moldeNos.ordem), asc(moldeNos.id));
  if (receita.length === 0) {
    return { erro: `${molde.nome} ainda não tem nenhuma peça. Monte a estrutura antes.` };
  }

  /* Nome da divisao copiado agora: renomear "Domo" daqui a um mes nao pode
     mudar o que foi montado hoje. */
  const nomes = new Map(
    (
      await db.select({ id: sql<string>`d.id`, nome: sql<string>`d.nome` }).from(sql`divisoes d`)
    ).map((d) => [d.id, d.nome]),
  );

  const numero = await proximoNumero();
  const [montagem] = await db
    .insert(montagens)
    .values({
      numero,
      moldeId,
      itemId: molde.itemId,
      nome: molde.nome,
      status: "em_montagem",
    })
    .returning();

  /* Copia a arvore preservando o desenho: primeiro cria todos os nos, e o
     mapa de id antigo para novo religa os pais. */
  const mapa = new Map<string, string>();
  for (const no of receita) {
    const [criado] = await db
      .insert(montagemNos)
      .values({
        montagemId: montagem.id,
        paiId: null,
        nome: no.divisaoId ? (nomes.get(no.divisaoId) ?? "Divisão") : null,
        itemId: no.itemId,
        quantidade: no.quantidade,
        localMontagem: no.localMontagem,
        ordem: no.ordem,
      })
      .returning();
    mapa.set(no.id, criado.id);
  }
  for (const no of receita) {
    if (!no.paiId) continue;
    await db
      .update(montagemNos)
      .set({ paiId: mapa.get(no.paiId) })
      .where(eq(montagemNos.id, mapa.get(no.id)!));
  }

  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: montagem.id,
    acao: "criar",
    depois: { ...montagem, nos: receita.length },
  });

  revalidarTudo();
  return { numero };
}

/**
 * As peças que esta montagem consome, com a quantidade já multiplicada nível
 * a nível. Divisão não consome nada: ela só agrupa.
 */
async function pecasDaMontagem(montagemId: string): Promise<Map<string, number>> {
  const nos = await db
    .select({
      id: montagemNos.id,
      paiId: montagemNos.paiId,
      itemId: montagemNos.itemId,
      quantidade: montagemNos.quantidade,
    })
    .from(montagemNos)
    .where(eq(montagemNos.montagemId, montagemId))
    .orderBy(asc(montagemNos.ordem), asc(montagemNos.id));

  const filhosDe = new Map<string | null, typeof nos>();
  for (const n of nos) filhosDe.set(n.paiId, [...(filhosDe.get(n.paiId) ?? []), n]);

  const total = new Map<string, number>();

  function descer(paiId: string | null, fator: number, caminho: Set<string>) {
    /* Trava de seguranca: a arvore nao deveria ter ciclo, mas um laco vindo
       de dado antigo nao pode travar a aplicacao. */
    if (paiId && caminho.has(paiId)) return;
    const novoCaminho = paiId ? new Set(caminho).add(paiId) : caminho;

    for (const no of filhosDe.get(paiId) ?? []) {
      const q = no.quantidade * fator;
      if (no.itemId) total.set(no.itemId, (total.get(no.itemId) ?? 0) + q);
      else descer(no.id, q, novoCaminho);
    }
  }

  descer(null, 1, new Set());
  return total;
}

/** Cada peça da montagem com o saldo de hoje ao lado. */
async function conferir(montagemId: string): Promise<FaltaNaMontagem[]> {
  const pecas = await pecasDaMontagem(montagemId);
  if (pecas.size === 0) return [];

  const info = await db
    .select({
      id: itens.id,
      codigo: itens.codigo,
      descricao: itens.descricao,
      unidade: unidades.sigla,
      disponivel: sql<number>`coalesce(${saldos.fisico}, 0) - coalesce(${saldos.reservado}, 0)`,
    })
    .from(itens)
    .leftJoin(unidades, eq(unidades.id, itens.unidadeId))
    .leftJoin(saldos, eq(saldos.itemId, itens.id))
    .where(inArray(itens.id, [...pecas.keys()]))
    .orderBy(asc(itens.codigo));

  return info.map((i) => ({
    itemId: i.id,
    nome: `${i.codigo} — ${i.descricao}`,
    necessario: pecas.get(i.id) ?? 0,
    disponivel: i.disponivel,
    unidade: i.unidade,
  }));
}

/** O que a tela mostra antes de a pessoa clicar em Montar. */
export async function conferirMontagem(
  montagemId: string,
): Promise<{ pecas: FaltaNaMontagem[]; podeMontar: boolean }> {
  await exigirSessao();
  const pecas = await conferir(montagemId);
  return {
    pecas,
    podeMontar: pecas.length > 0 && pecas.every((p) => p.disponivel >= p.necessario),
  };
}

/**
 * Monta: dá baixa em todas as peças da árvore e dá entrada de uma unidade do
 * item produzido.
 *
 * É o único caminho entre esta tela e o estoque, e ele anda nos dois
 * sentidos: sai o que foi consumido, entra o que ficou pronto.
 */
export async function montarMontagem(montagemId: string): Promise<ResultadoMontagem> {
  const sessao = await exigirEdicao();

  const [montagem] = await db.select().from(montagens).where(eq(montagens.id, montagemId));
  if (!montagem) return { erro: "Montagem não encontrada." };
  if (montagem.status !== "em_montagem") return { erro: "Esta montagem já foi montada." };

  /* Confere de novo no servidor, e nao no que a tela mandou: entre abrir a
     janela e confirmar, alguem pode ter consumido a ultima peca. */
  const pecas = await conferir(montagemId);
  if (pecas.length === 0) return { erro: "Esta montagem não tem nenhuma peça dentro." };

  const faltando = pecas.filter((p) => p.disponivel < p.necessario);
  if (faltando.length > 0) return { faltando };

  /* Sem transacao no driver HTTP do Neon, a ordem importa: primeiro as
     saidas, depois a entrada do item pronto, e so entao o status. Se algo
     falhar no meio, sobra peca consumida com a montagem ainda aberta —
     visivel e corrigivel, ao contrario do inverso, que daria entrada num
     item sem ter consumido nada. */
  for (const peca of pecas) {
    await db.insert(movimentos).values({
      itemId: peca.itemId,
      tipo: "saida_producao",
      quantidade: peca.necessario,
      referencia: montagem.numero,
      usuarioId: sessao.id,
      observacao: `Consumido na montagem ${montagem.numero}`,
      montagemId: montagem.id,
    });
  }

  await db.insert(movimentos).values({
    itemId: montagem.itemId,
    tipo: "entrada_fabricacao",
    quantidade: 1,
    referencia: montagem.numero,
    usuarioId: sessao.id,
    observacao: `Montado em ${montagem.numero}`,
    montagemId: montagem.id,
  });

  const agora = new Date();
  const [depois] = await db
    .update(montagens)
    .set({ status: "montada", montadaEm: agora, montadaPor: sessao.id })
    .where(eq(montagens.id, montagemId))
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: montagemId,
    acao: "atualizar",
    antes: montagem,
    depois: { ...depois, consumidos: pecas.length },
  });

  revalidarTudo();
  return { ok: true };
}

/**
 * Excluir só vale enquanto nada foi montado. Depois de montada, a montagem
 * virou movimento no estoque — e movimento não se apaga.
 */
export async function excluirMontagem(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  const [montagem] = await db.select().from(montagens).where(eq(montagens.id, id));
  if (!montagem) return { erro: "Montagem não encontrada." };

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(movimentos)
    .where(eq(movimentos.montagemId, id));
  if (montagem.status !== "em_montagem" || n > 0) {
    return { erro: "Esta montagem já foi montada e mexeu no estoque. Ela não pode ser excluída." };
  }

  await db.delete(montagens).where(eq(montagens.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: id,
    acao: "excluir",
    antes: montagem,
  });
  revalidarTudo();
  return {};
}

function revalidarTudo() {
  revalidatePath("/montagem");
  revalidatePath("/estoque");
  revalidatePath("/itens");
  revalidatePath("/");
}
