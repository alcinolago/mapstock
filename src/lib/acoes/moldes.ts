"use server";

import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { itens, moldeNos, moldes, montagens } from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";

/**
 * A estrutura: uma arvore de divisoes e pecas, servindo a duas coisas.
 *
 *   sem item  manual do equipamento completo. Documentacao de bancada.
 *   com item  receita de um item do estoque — o conjunto. E o que a montagem
 *             executa, e o que faz o domo existir na prateleira.
 *
 * Nada aqui encosta no estoque. Criar, acrescentar divisao, mudar
 * quantidade — tudo isso e planejamento, e vale mesmo sem ter uma peca
 * sequer na prateleira. Quem confere saldo e a montagem.
 */
export type EstadoMolde = { erro?: string; ok?: boolean; id?: string };

export async function salvarMolde(
  _estado: EstadoMolde,
  formulario: FormData,
): Promise<EstadoMolde> {
  const sessao = await exigirEdicao();

  const id = (formulario.get("id") as string) || null;
  const nome = ((formulario.get("nome") as string) ?? "").trim();
  const descricao = ((formulario.get("descricao") as string) ?? "").trim() || null;
  const itemId = ((formulario.get("itemId") as string) ?? "").trim() || null;
  if (!nome) return { erro: "Informe o nome." };

  const [repetido] = await db
    .select({ id: moldes.id })
    .from(moldes)
    .where(sql`lower(${moldes.nome}) = lower(${nome})`);
  if (repetido && repetido.id !== id) {
    return { erro: `Já existe uma estrutura chamada "${nome}".` };
  }

  /* O item so se escolhe na criacao. Trocar depois mudaria o que a estrutura
     produz sem mexer numa linha da arvore — e o caminho mais curto para um
     conjunto que se consome a si mesmo. Errou o item: exclui e cria de novo. */
  if (!id && itemId) {
    const [item] = await db.select({ id: itens.id }).from(itens).where(eq(itens.id, itemId));
    if (!item) return { erro: "Item não encontrado." };

    const [jaTem] = await db
      .select({ nome: moldes.nome })
      .from(moldes)
      .where(eq(moldes.itemId, itemId));
    if (jaTem) {
      return { erro: `Este item já tem estrutura: "${jaTem.nome}". Um item tem uma receita só.` };
    }
  }

  if (id) {
    const [antes] = await db.select().from(moldes).where(eq(moldes.id, id));
    if (!antes) return { erro: "Estrutura não encontrada." };
    const [depois] = await db
      .update(moldes)
      .set({ nome, descricao, atualizadoEm: new Date(), atualizadoPor: sessao.id })
      .where(eq(moldes.id, id))
      .returning();
    await registrar({
      usuarioId: sessao.id,
      tabela: "moldes",
      registroId: id,
      acao: "atualizar",
      antes,
      depois,
    });
    revalidatePath("/estrutura");
    revalidatePath("/conjuntos");
    return { ok: true, id };
  }

  const [criado] = await db
    .insert(moldes)
    .values({ nome, descricao, itemId, criadoPor: sessao.id, atualizadoPor: sessao.id })
    .returning();
  await registrar({
    usuarioId: sessao.id,
    tabela: "moldes",
    registroId: criado.id,
    acao: "criar",
    depois: criado,
  });
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return { ok: true, id: criado.id };
}

export async function excluirMolde(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [antes] = await db.select().from(moldes).where(eq(moldes.id, id));
  if (!antes) return { erro: "Estrutura não encontrada." };

  /* Montagem ja aberta segura a estrutura. Ela guarda a propria copia da
     arvore, entao nao quebraria — mas perder de onde ela veio apaga o rastro. */
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(montagens)
    .where(eq(montagens.moldeId, id));
  if (n > 0) {
    return {
      erro: `Esta estrutura já gerou ${n} ${n === 1 ? "montagem" : "montagens"}. Desative em vez de excluir, para não perder de onde elas vieram.`,
    };
  }

  await db.delete(moldes).where(eq(moldes.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "moldes",
    registroId: id,
    acao: "excluir",
    antes,
  });
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return {};
}

export async function alternarMolde(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  const [antes] = await db.select().from(moldes).where(eq(moldes.id, id));
  if (!antes) return { erro: "Estrutura não encontrada." };

  const [depois] = await db
    .update(moldes)
    .set({ ativo: !antes.ativo, atualizadoEm: new Date(), atualizadoPor: sessao.id })
    .where(eq(moldes.id, id))
    .returning();
  await registrar({
    usuarioId: sessao.id,
    tabela: "moldes",
    registroId: id,
    acao: "atualizar",
    antes,
    depois,
  });
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return {};
}

/* --------------------------------------------------------- Nós da árvore */

/**
 * Um conjunto dentro do outro e normal — a placa montada entra no domo. Um conjunto
 * dentro de si mesmo, mesmo com tres niveis no meio, nao: a montagem entraria
 * em laco infinito na hora de explodir a arvore.
 *
 * Desce pela receita de `itemId` procurando `alvo`. Conjunto sem receita e folha,
 * que e o caso da esmagadora maioria dos itens.
 */
async function conjuntoConsome(
  itemId: string,
  alvo: string,
  visitados = new Set<string>(),
): Promise<boolean> {
  if (itemId === alvo) return true;
  if (visitados.has(itemId)) return false;
  visitados.add(itemId);

  const [molde] = await db.select({ id: moldes.id }).from(moldes).where(eq(moldes.itemId, itemId));
  if (!molde) return false;

  const dentro = await db
    .select({ itemId: moldeNos.itemId })
    .from(moldeNos)
    .where(and(eq(moldeNos.moldeId, molde.id), isNotNull(moldeNos.itemId)));

  for (const filho of dentro) {
    if (await conjuntoConsome(filho.itemId!, alvo, visitados)) return true;
  }
  return false;
}

const esquemaNo = z.object({
  moldeId: z.uuid(),
  paiId: z.union([z.literal(""), z.uuid()]).optional(),
  divisaoId: z.union([z.literal(""), z.uuid()]).optional(),
  itemId: z.union([z.literal(""), z.uuid()]).optional(),
  quantidade: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v > 0, "Informe uma quantidade maior que zero"),
  localMontagem: z.string().trim().optional(),
});

export type EstadoNo = { erro?: string; ok?: boolean };

export async function adicionarNo(_estado: EstadoNo, formulario: FormData): Promise<EstadoNo> {
  const sessao = await exigirEdicao();

  const dados = esquemaNo.safeParse(Object.fromEntries(formulario));
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = dados.data;
  const divisaoId = d.divisaoId || null;
  const itemId = d.itemId || null;
  const paiId = d.paiId || null;

  /* Um no e divisao ou peca, nunca os dois e nunca nenhum. E a invariante
     que faz a arvore ter sentido: agrupador agrupa, peca sai do estoque. */
  if (!divisaoId === !itemId) {
    return { erro: "Escolha uma divisão ou uma peça do estoque." };
  }

  if (paiId) {
    const [pai] = await db.select().from(moldeNos).where(eq(moldeNos.id, paiId));
    if (!pai) return { erro: "Nó pai não encontrado." };
    if (pai.itemId) {
      return { erro: "Peça do estoque não contém nada. Pendure dentro de uma divisão." };
    }
  }

  if (itemId) {
    const [molde] = await db
      .select({ itemId: moldes.itemId, nome: moldes.nome })
      .from(moldes)
      .where(eq(moldes.id, d.moldeId));
    if (molde?.itemId && (await conjuntoConsome(itemId, molde.itemId))) {
      return {
        erro: `Isso faz ${molde.nome} entrar em si mesmo — direto ou por dentro de outro conjunto.`,
      };
    }
  }

  /* Divisao repetida no mesmo pai vira duas linhas iguais na arvore, sem
     jeito de saber qual e qual. Peca repetida idem: some a quantidade. */
  const irmaos = await db
    .select()
    .from(moldeNos)
    .where(
      and(
        eq(moldeNos.moldeId, d.moldeId),
        paiId ? eq(moldeNos.paiId, paiId) : isNull(moldeNos.paiId),
      ),
    );
  if (irmaos.some((i) => (divisaoId && i.divisaoId === divisaoId) || (itemId && i.itemId === itemId))) {
    return { erro: "Isso já está nesta parte da estrutura." };
  }

  const [criado] = await db
    .insert(moldeNos)
    .values({
      moldeId: d.moldeId,
      paiId,
      divisaoId,
      itemId,
      quantidade: d.quantidade,
      localMontagem: d.localMontagem || null,
      ordem: irmaos.length + 1,
    })
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "molde_nos",
    registroId: criado.id,
    acao: "criar",
    depois: criado,
  });
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return { ok: true };
}

const esquemaPecas = z.object({
  moldeId: z.uuid(),
  paiId: z.uuid().nullable(),
  pecas: z
    .array(
      z.object({
        itemId: z.uuid(),
        quantidade: esquemaNo.shape.quantidade,
        localMontagem: z.string().trim().optional(),
      }),
    )
    .min(1, "Escolha pelo menos uma peça."),
});

/**
 * Varias pecas de uma vez, cada uma com a sua quantidade.
 *
 * Existe porque montar a receita de um domo peca por peca era abrir e fechar
 * a janela vinte vezes. As regras sao as de `adicionarNo`, conferidas para
 * todas antes de gravar qualquer uma: o driver HTTP do Neon nao tem
 * transacao, entao o que garante o tudo-ou-nada e conferir antes e gravar
 * num `insert` so. Meia lista gravada deixaria a pessoa sem saber o que
 * entrou e o que tem que repetir.
 */
export async function adicionarPecas(entrada: {
  moldeId: string;
  paiId: string | null;
  pecas: { itemId: string; quantidade: string; localMontagem?: string }[];
}): Promise<EstadoNo> {
  const sessao = await exigirEdicao();

  const dados = esquemaPecas.safeParse(entrada);
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { moldeId, paiId, pecas } = dados.data;

  if (new Set(pecas.map((p) => p.itemId)).size !== pecas.length) {
    return { erro: "A mesma peça está duas vezes na lista. Some as quantidades numa linha só." };
  }

  if (paiId) {
    const [pai] = await db.select().from(moldeNos).where(eq(moldeNos.id, paiId));
    if (!pai) return { erro: "Nó pai não encontrado." };
    if (pai.itemId) {
      return { erro: "Peça do estoque não contém nada. Pendure dentro de uma divisão." };
    }
  }

  const codigos = new Map(
    (
      await db
        .select({ id: itens.id, codigo: itens.codigo })
        .from(itens)
        .where(inArray(itens.id, pecas.map((p) => p.itemId)))
    ).map((i) => [i.id, i.codigo] as const),
  );

  const [molde] = await db
    .select({ itemId: moldes.itemId, nome: moldes.nome })
    .from(moldes)
    .where(eq(moldes.id, moldeId));
  if (!molde) return { erro: "Estrutura não encontrada." };

  if (molde.itemId) {
    for (const p of pecas) {
      if (await conjuntoConsome(p.itemId, molde.itemId)) {
        return {
          erro: `${codigos.get(p.itemId) ?? "Uma das peças"} faz ${molde.nome} entrar em si mesmo — direto ou por dentro de outro conjunto.`,
        };
      }
    }
  }

  const irmaos = await db
    .select()
    .from(moldeNos)
    .where(and(eq(moldeNos.moldeId, moldeId), paiId ? eq(moldeNos.paiId, paiId) : isNull(moldeNos.paiId)));
  const repetidas = pecas.filter((p) => irmaos.some((i) => i.itemId === p.itemId));
  if (repetidas.length > 0) {
    return {
      erro: `Já está nesta parte da estrutura: ${repetidas.map((p) => codigos.get(p.itemId)).join(", ")}. Tire da lista para adicionar as outras.`,
    };
  }

  const criados = await db
    .insert(moldeNos)
    .values(
      pecas.map((p, i) => ({
        moldeId,
        paiId,
        itemId: p.itemId,
        quantidade: p.quantidade,
        localMontagem: p.localMontagem || null,
        ordem: irmaos.length + 1 + i,
      })),
    )
    .returning();

  for (const criado of criados) {
    await registrar({
      usuarioId: sessao.id,
      tabela: "molde_nos",
      registroId: criado.id,
      acao: "criar",
      depois: criado,
    });
  }
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return { ok: true };
}

export async function removerNo(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  const [antes] = await db.select().from(moldeNos).where(eq(moldeNos.id, id));
  if (!antes) return { erro: "Nó não encontrado." };

  /* O cascade do banco leva os filhos junto; o log guarda quantos eram para
     a exclusao nao virar um buraco silencioso na auditoria. */
  const [{ filhos }] = await db
    .select({ filhos: sql<number>`count(*)::int` })
    .from(moldeNos)
    .where(eq(moldeNos.paiId, id));

  await db.delete(moldeNos).where(eq(moldeNos.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "molde_nos",
    registroId: id,
    acao: "excluir",
    antes: { ...antes, filhosLevadosJunto: filhos },
  });
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return {};
}

export async function atualizarQuantidadeNo(
  id: string,
  quantidade: number,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { erro: "Informe uma quantidade maior que zero." };
  }
  await db.update(moldeNos).set({ quantidade }).where(eq(moldeNos.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "molde_nos",
    registroId: id,
    acao: "atualizar",
    depois: { quantidade },
  });
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return {};
}

/**
 * Sobe ou desce um no entre os irmaos. A ordem e sequencia de montagem, nao
 * enfeite: quem monta segue a lista de cima para baixo.
 */
export async function moverNo(id: string, direcao: "cima" | "baixo"): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [alvo] = await db.select().from(moldeNos).where(eq(moldeNos.id, id));
  if (!alvo) return { erro: "Nó não encontrado." };

  const irmaos = await db
    .select()
    .from(moldeNos)
    .where(
      and(
        eq(moldeNos.moldeId, alvo.moldeId),
        alvo.paiId ? eq(moldeNos.paiId, alvo.paiId) : isNull(moldeNos.paiId),
      ),
    )
    .orderBy(asc(moldeNos.ordem), asc(moldeNos.id));

  const posicao = irmaos.findIndex((v) => v.id === id);
  const destino = direcao === "cima" ? posicao - 1 : posicao + 1;
  if (destino < 0 || destino >= irmaos.length) return {};

  /* Renumera a lista inteira em vez de trocar duas: empate de ordem vindo de
     insercao concorrente faria a troca simples nao surtir efeito nenhum. */
  const nova = [...irmaos];
  [nova[posicao], nova[destino]] = [nova[destino], nova[posicao]];
  for (const [i, v] of nova.entries()) {
    await db.update(moldeNos).set({ ordem: i + 1 }).where(eq(moldeNos.id, v.id));
  }

  await registrar({
    usuarioId: sessao.id,
    tabela: "molde_nos",
    registroId: id,
    acao: "atualizar",
    antes: { ordem: posicao + 1 },
    depois: { ordem: destino + 1 },
  });
  revalidatePath("/estrutura");
  revalidatePath("/conjuntos");
  return {};
}

/**
 * Achata um molde nas pecas de estoque que ele consome, com a quantidade
 * total ja multiplicada nivel a nivel. E o que alimenta a cotacao a partir
 * de um equipamento — e, mais adiante, a partir de uma divisao.
 *
 * `de` limita a um ramo: passando o id de uma divisao, sai so o que entra
 * nela. Nulo explode o molde inteiro.
 */
export async function explodirMolde(
  moldeId: string,
  multiplicador = 1,
  de: string | null = null,
): Promise<{ itemId: string; quantidade: number }[]> {
  const nos = await db
    .select()
    .from(moldeNos)
    .where(eq(moldeNos.moldeId, moldeId))
    .orderBy(asc(moldeNos.ordem));

  const filhosDe = new Map<string | null, typeof nos>();
  for (const n of nos) {
    filhosDe.set(n.paiId, [...(filhosDe.get(n.paiId) ?? []), n]);
  }

  const total = new Map<string, number>();

  function descer(paiId: string | null, fator: number, caminho: Set<string>) {
    /* Trava de seguranca: o molde nao deveria ter ciclo, mas um laco vindo de
       dado antigo nao pode travar a aplicacao. */
    if (paiId && caminho.has(paiId)) return;
    const novoCaminho = paiId ? new Set(caminho).add(paiId) : caminho;

    for (const no of filhosDe.get(paiId) ?? []) {
      const q = no.quantidade * fator;
      if (no.itemId) {
        total.set(no.itemId, (total.get(no.itemId) ?? 0) + q);
      } else {
        descer(no.id, q, novoCaminho);
      }
    }
  }

  descer(de, multiplicador, new Set());

  return [...total.entries()].map(([itemId, quantidade]) => ({ itemId, quantidade }));
}
