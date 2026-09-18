"use server";

import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { carros, moldeNos, moldes, montagemNos, montagens, movimentos } from "@/db/schema";
import { exigirEdicao, exigirSessao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { OPOSTO_MOVIMENTO } from "@/lib/labels";

/**
 * Montagem: o evento que transforma peças em equipamento.
 *
 * Abrir uma montagem copia a árvore do molde para dentro dela. A cópia não é
 * otimização: é o que separa planejar de executar. Editar o molde amanhã não
 * pode reescrever o que já foi montado ontem, e cada equipamento em produção
 * segue a receita que valia quando ele começou.
 *
 * Pedir três equipamentos abre três árvores independentes. Cada uma no seu
 * quadrado, montada no seu ritmo — sem contador de "2 de 3", sem uma esperar
 * a outra. Foi assim que o pessoal descreveu a bancada.
 *
 * Só divisão se monta. Peça não se monta: ela é consumida quando a divisão
 * que a contém fecha.
 */

export type FaltaNaMontagem = {
  tipo: "peca" | "divisao";
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
async function proximoNumero(sequencia: number): Promise<string> {
  const inicio = `MNT-${new Date().getFullYear()}-`;
  const [linha] = await db
    .select({ numero: montagens.numero })
    .from(montagens)
    .where(sql`${montagens.numero} like ${inicio + "%"}`)
    .orderBy(desc(montagens.numero))
    .limit(1);

  const ultimo = linha ? Number(linha.numero.slice(inicio.length)) : 0;
  return `${inicio}${String(ultimo + sequencia).padStart(4, "0")}`;
}

/**
 * Abre N árvores a partir de um molde. Não encosta no estoque: abrir é
 * planejar, e vale mesmo sem ter nenhuma peça na prateleira.
 */
export async function abrirMontagens(
  moldeId: string,
  quantidade: number,
): Promise<{ erro?: string; numeros?: string[] }> {
  const sessao = await exigirEdicao();

  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) {
    return { erro: "Informe de 1 a 50 equipamentos." };
  }

  const [molde] = await db.select().from(moldes).where(eq(moldes.id, moldeId));
  if (!molde) return { erro: "Molde não encontrado." };

  const receita = await db
    .select()
    .from(moldeNos)
    .where(eq(moldeNos.moldeId, moldeId))
    .orderBy(asc(moldeNos.ordem), asc(moldeNos.id));
  if (receita.length === 0) {
    return { erro: `${molde.nome} ainda não tem nenhuma divisão ou peça. Monte a estrutura antes.` };
  }

  /* Nome da divisao copiado agora: renomear "Domo" daqui a um mes nao pode
     mudar o que foi montado hoje. */
  const nomes = new Map(
    (
      await db
        .select({ id: sql<string>`d.id`, nome: sql<string>`d.nome` })
        .from(sql`divisoes d`)
    ).map((d) => [d.id, d.nome]),
  );

  const numeros: string[] = [];

  for (let n = 1; n <= quantidade; n++) {
    const numero = await proximoNumero(n);
    const [montagem] = await db
      .insert(montagens)
      .values({
        numero,
        moldeId,
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
          obrigatorio: no.obrigatorio,
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
    numeros.push(numero);
  }

  revalidarTudo();
  return { numeros };
}

/** Os filhos diretos de um nó (ou da raiz), com o que falta para fechá-lo. */
export async function conferirNo(
  montagemId: string,
  noId: string | null,
): Promise<{ erro?: string; filhos?: FaltaNaMontagem[]; podeMontar?: boolean }> {
  await exigirSessao();
  const filhos = await filhosComEstado(montagemId, noId);
  if (!filhos) return { erro: "Nó não encontrado." };
  return {
    filhos,
    podeMontar: filhos.every((f) => f.disponivel >= f.necessario),
  };
}

async function filhosComEstado(
  montagemId: string,
  noId: string | null,
): Promise<FaltaNaMontagem[] | null> {
  const linhas = await db
    .select({
      id: montagemNos.id,
      nome: montagemNos.nome,
      itemId: montagemNos.itemId,
      quantidade: montagemNos.quantidade,
      obrigatorio: montagemNos.obrigatorio,
      montadoEm: montagemNos.montadoEm,
      codigo: sql<string | null>`i.codigo`,
      descricao: sql<string | null>`i.descricao`,
      unidade: sql<string | null>`u.sigla`,
      disponivel: sql<number>`coalesce(s.fisico, 0) - coalesce(s.reservado, 0)`,
    })
    .from(montagemNos)
    .leftJoin(sql`itens i`, sql`i.id = ${montagemNos.itemId}`)
    .leftJoin(sql`unidades u`, sql`u.id = i.unidade_id`)
    .leftJoin(sql`saldos s`, sql`s.item_id = ${montagemNos.itemId}`)
    .where(
      noId
        ? sql`${montagemNos.montagemId} = ${montagemId} and ${montagemNos.paiId} = ${noId}`
        : sql`${montagemNos.montagemId} = ${montagemId} and ${montagemNos.paiId} is null`,
    )
    .orderBy(asc(montagemNos.ordem), asc(montagemNos.id));

  return linhas.map((l) => ({
    tipo: l.itemId ? ("peca" as const) : ("divisao" as const),
    nome: l.itemId ? `${l.codigo} — ${l.descricao}` : (l.nome ?? "Divisão"),
    necessario: l.itemId ? l.quantidade : 1,
    /* Divisao "disponivel" e binario: montada ou nao. Isso deixa a tela e a
       checagem falarem a mesma lingua, sem dois caminhos de comparacao. */
    disponivel: l.itemId ? l.disponivel : l.montadoEm ? 1 : 0,
    unidade: l.unidade,
  }));
}

/**
 * Fecha um nó: dá baixa nas peças que ele contém e o congela.
 *
 * `noId` nulo é a raiz — fechar a raiz conclui o equipamento e libera a
 * associação com o carro.
 */
export async function montarNo(
  montagemId: string,
  noId: string | null,
): Promise<ResultadoMontagem> {
  const sessao = await exigirEdicao();

  const [montagem] = await db.select().from(montagens).where(eq(montagens.id, montagemId));
  if (!montagem) return { erro: "Montagem não encontrada." };
  if (montagem.status === "desmontada") return { erro: "Esta montagem foi desmontada." };
  if (montagem.status !== "em_montagem") return { erro: "Este equipamento já está montado." };

  if (noId) {
    const [no] = await db.select().from(montagemNos).where(eq(montagemNos.id, noId));
    if (!no || no.montagemId !== montagemId) return { erro: "Nó não encontrado." };
    if (no.itemId) return { erro: "Peça não se monta — ela sai do estoque junto com a divisão." };
    if (no.montadoEm) return { erro: "Esta divisão já foi montada." };
  }

  /* Confere de novo no servidor, e nao no que a tela mandou: entre abrir a
     janela e confirmar, alguem pode ter consumido a ultima peca. */
  const filhos = await filhosComEstado(montagemId, noId);
  if (!filhos) return { erro: "Nó não encontrado." };

  /* Divisao vazia pode ser fechada: ela nao consome nada, mas marca a etapa
     como feita. Sem isso, uma divisao sem peca travava a montagem inteira —
     nunca podia ser montada, e o equipamento nunca chegava ao fim. */
  if (filhos.length === 0 && !noId) {
    return { erro: "Esta montagem não tem nada dentro." };
  }

  const faltando = filhos.filter((f) => f.disponivel < f.necessario);
  if (faltando.length > 0) return { faltando };

  /* Sem transacao no driver HTTP do Neon, a ordem importa: primeiro as
     saidas, e so depois o congelamento. Se algo falhar no meio, sobra peca
     consumida sem o no fechado — visivel e corrigivel, ao contrario do
     inverso, que esconderia consumo que nunca aconteceu. */
  const pecas = await db
    .select({ id: montagemNos.id, itemId: montagemNos.itemId, quantidade: montagemNos.quantidade })
    .from(montagemNos)
    .where(
      noId
        ? sql`${montagemNos.montagemId} = ${montagemId} and ${montagemNos.paiId} = ${noId} and ${montagemNos.itemId} is not null`
        : sql`${montagemNos.montagemId} = ${montagemId} and ${montagemNos.paiId} is null and ${montagemNos.itemId} is not null`,
    );

  const agora = new Date();
  for (const peca of pecas) {
    await db.insert(movimentos).values({
      itemId: peca.itemId!,
      tipo: "saida_producao",
      quantidade: peca.quantidade,
      referencia: montagem.numero,
      usuarioId: sessao.id,
      observacao: `Consumido na montagem ${montagem.numero}`,
      montagemId: montagem.id,
    });
  }

  if (noId) {
    await db
      .update(montagemNos)
      .set({ montadoEm: agora, montadoPor: sessao.id })
      .where(eq(montagemNos.id, noId));
  } else {
    await db
      .update(montagens)
      .set({ status: "montada", montadaEm: agora, montadaPor: sessao.id })
      .where(eq(montagens.id, montagemId));
  }

  await registrar({
    usuarioId: sessao.id,
    tabela: noId ? "montagem_nos" : "montagens",
    registroId: noId ?? montagemId,
    acao: "atualizar",
    depois: {
      montadoEm: agora,
      consumidos: pecas.length,
      referencia: montagem.numero,
    },
  });

  revalidarTudo();
  return { ok: true };
}

export async function associarCarro(
  montagemId: string,
  carroId: string | null,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [montagem] = await db.select().from(montagens).where(eq(montagens.id, montagemId));
  if (!montagem) return { erro: "Montagem não encontrada." };
  if (carroId && montagem.status !== "montada" && montagem.status !== "instalada") {
    return { erro: "O equipamento precisa estar montado por inteiro antes de ir para um carro." };
  }

  if (carroId) {
    const [ocupado] = await db
      .select({ numero: montagens.numero })
      .from(montagens)
      .where(sql`${montagens.carroId} = ${carroId} and ${montagens.id} <> ${montagemId}`);
    if (ocupado) return { erro: `Esse carro já tem o equipamento ${ocupado.numero}.` };
  }

  const [depois] = await db
    .update(montagens)
    .set({ carroId, status: carroId ? "instalada" : "montada" })
    .where(eq(montagens.id, montagemId))
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: montagemId,
    acao: "atualizar",
    antes: montagem,
    depois,
  });
  revalidarTudo();
  return {};
}

/**
 * O equipamento de um carro, visto do lado do carro.
 *
 * Nao lanca movimento nenhum: o equipamento montado nao e item de estoque,
 * entao instalar e tirar do carro nao muda saldo de nada. O que saiu do
 * estoque foram as pecas, e isso aconteceu la na montagem.
 */
export async function definirEquipamentoDoCarro(
  carroId: string,
  montagemId: string | null,
): Promise<{ erro?: string }> {
  const [atual] = await db.select().from(montagens).where(eq(montagens.carroId, carroId));
  if (atual?.id === montagemId) return {};

  if (atual) {
    const r = await associarCarro(atual.id, null);
    if (r.erro) return r;
  }
  if (montagemId) return associarCarro(montagemId, carroId);

  revalidarTudo();
  return {};
}

/**
 * Desmontar devolve as peças ao estoque lançando o oposto de cada movimento
 * da montagem — nunca apagando movimento, como manda a regra.
 */
export async function desmontarMontagem(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [montagem] = await db.select().from(montagens).where(eq(montagens.id, id));
  if (!montagem) return { erro: "Montagem não encontrada." };
  if (montagem.status === "desmontada") return { erro: "Esta montagem já foi desmontada." };

  if (montagem.carroId) {
    const [carro] = await db.select().from(carros).where(eq(carros.id, montagem.carroId));
    return {
      erro:
        `Esta montagem está instalada no carro ${carro?.placa ?? ""}. ` +
        "Tire do carro antes de desmontar.",
    };
  }

  const originais = await db.select().from(movimentos).where(eq(movimentos.montagemId, id));
  for (const original of originais) {
    await db.insert(movimentos).values({
      itemId: original.itemId,
      tipo: OPOSTO_MOVIMENTO[original.tipo],
      quantidade: original.quantidade,
      referencia: montagem.numero,
      usuarioId: sessao.id,
      observacao: `Desmontagem de ${montagem.numero}`,
      montagemId: montagem.id,
    });
  }

  await db
    .update(montagemNos)
    .set({ montadoEm: null, montadoPor: null })
    .where(eq(montagemNos.montagemId, id));

  const [depois] = await db
    .update(montagens)
    .set({ status: "desmontada", desmontadaEm: new Date() })
    .where(eq(montagens.id, id))
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: id,
    acao: "atualizar",
    antes: montagem,
    depois,
  });
  revalidarTudo();
  return {};
}

export async function excluirMontagem(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();
  const [montagem] = await db.select().from(montagens).where(eq(montagens.id, id));
  if (!montagem) return { erro: "Montagem não encontrada." };

  /* Só a que nunca consumiu nada. Qualquer coisa já montada sai por
     desmontar, que devolve as peças — apagar esconderia o consumo. */
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(movimentos)
    .where(eq(movimentos.montagemId, id));
  if (n > 0) {
    return { erro: "Esta montagem já consumiu peças. Use Desmontar, que devolve tudo ao estoque." };
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
  revalidatePath("/carros");
  revalidatePath("/");
}
