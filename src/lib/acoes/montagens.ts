"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { componentesDaMontagem, type ComponenteDaMontagem } from "@/db/consultas";
import { carros, itens, montagens, movimentos } from "@/db/schema";
import { exigirEdicao, exigirSessao } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { OPOSTO_MOVIMENTO } from "@/lib/labels";

/**
 * Montagem: o evento que transforma peças em equipamento pronto.
 *
 * A estrutura (bom) é a receita; a montagem é uma unidade que existe de
 * verdade. Por isso ela mexe no estoque de duas pontas: cada componente sai
 * e o equipamento entra. Sem isso o parafuso que já está dentro de um
 * equipamento continuaria aparecendo como disponível na prateleira.
 *
 * Só os filhos diretos são consumidos. Montar EQP-001 consome o conjunto
 * EST-001 inteiro, não os 24 parafusos dele — os parafusos saíram do estoque
 * quando EST-001 foi montada.
 */

export type ResultadoMontagem = {
  erro?: string;
  /* Quando falta peça, a tela mostra exatamente o que falta em vez de um
     "não foi possível" — quem está na bancada precisa saber o que comprar. */
  faltando?: ComponenteDaMontagem[];
  numero?: string;
  id?: string;
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

/** O que a modal de montagem mostra antes de confirmar. */
export async function verificarMontagem(itemId: string): Promise<ComponenteDaMontagem[]> {
  await exigirSessao();
  return componentesDaMontagem(itemId);
}

export async function montarEstrutura(
  itemId: string,
  dados: { local?: string; observacoes?: string; opcionais?: string[] },
): Promise<ResultadoMontagem> {
  const sessao = await exigirEdicao();

  const [item] = await db
    .select({ id: itens.id, codigo: itens.codigo, descricao: itens.descricao })
    .from(itens)
    .where(eq(itens.id, itemId));
  if (!item) return { erro: "Item não encontrado." };

  /* Confere de novo no servidor, e não no que a tela mandou: entre abrir a
     modal e confirmar, alguém pode ter consumido a última peça. */
  const componentes = await componentesDaMontagem(itemId);
  if (componentes.length === 0) {
    return {
      erro:
        `${item.codigo} não tem estrutura cadastrada. ` +
        "Monte a árvore de componentes antes de marcar como montada.",
    };
  }

  const escolhidos = new Set(dados.opcionais ?? []);
  const aConsumir = componentes.filter((c) => c.obrigatorio || escolhidos.has(c.itemId));

  const faltando = aConsumir.filter((c) => c.disponivel < c.necessario);
  if (faltando.length > 0) return { faltando };

  const numero = await proximoNumero();

  const [montagem] = await db
    .insert(montagens)
    .values({
      numero,
      itemId,
      status: "montada",
      local: dados.local?.trim() || null,
      observacoes: dados.observacoes?.trim() || null,
      montadaPor: sessao.id,
    })
    .returning();

  /* O driver HTTP do Neon não faz transação entre comandos, então a ordem
     importa: primeiro as saídas, e só depois a entrada do equipamento. Se
     algo falhar no meio, o que sobra é peça consumida sem equipamento —
     visível e corrigível pelo estorno, ao contrário do inverso. */
  for (const c of aConsumir) {
    await db.insert(movimentos).values({
      itemId: c.itemId,
      tipo: "saida_producao",
      quantidade: c.necessario,
      referencia: numero,
      usuarioId: sessao.id,
      observacao: `Consumido na montagem ${numero} de ${item.codigo}`,
      montagemId: montagem.id,
    });
  }

  await db.insert(movimentos).values({
    itemId,
    tipo: "entrada_fabricacao",
    quantidade: 1,
    referencia: numero,
    usuarioId: sessao.id,
    observacao: dados.local?.trim()
      ? `Montagem ${numero} — ${dados.local.trim()}`
      : `Montagem ${numero}`,
    montagemId: montagem.id,
  });

  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: montagem.id,
    acao: "criar",
    depois: { ...montagem, consumidos: aConsumir.map((c) => `${c.codigo} x${c.necessario}`) },
  });

  revalidarTudo();
  return { numero, id: montagem.id };
}

/**
 * Desmontar devolve as peças para o estoque lançando o oposto de cada
 * movimento da montagem — nunca apagando movimento, como manda a regra.
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

/**
 * Instala (ou tira) o equipamento de um carro — é o campo "Equipamento" do
 * cadastro do carro visto de perto.
 *
 * Instalar tira a unidade do estoque: ela está em uso no carro, não parada
 * na prateleira esperando. Tirar do carro devolve.
 */
export async function definirEquipamentoDoCarro(
  carroId: string,
  montagemId: string | null,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [carro] = await db.select().from(carros).where(eq(carros.id, carroId));
  if (!carro) return { erro: "Carro não encontrado." };

  const [atual] = await db.select().from(montagens).where(eq(montagens.carroId, carroId));
  if (atual?.id === montagemId) return {};

  /* Tira a que estava lá antes, seja para trocar, seja para deixar vazio. */
  if (atual) {
    await db.insert(movimentos).values({
      itemId: atual.itemId,
      tipo: "entrada_fabricacao",
      quantidade: 1,
      referencia: atual.numero,
      usuarioId: sessao.id,
      observacao: `Retirada do carro ${carro.placa}, de volta ao estoque`,
      montagemId: atual.id,
    });

    await db
      .update(montagens)
      .set({ status: "montada", carroId: null, local: null })
      .where(eq(montagens.id, atual.id));

    await registrar({
      usuarioId: sessao.id,
      tabela: "montagens",
      registroId: atual.id,
      acao: "atualizar",
      antes: atual,
      depois: { status: "montada", carroId: null },
    });
  }

  if (!montagemId) {
    revalidarTudo();
    return {};
  }

  const [nova] = await db
    .select()
    .from(montagens)
    .where(and(eq(montagens.id, montagemId), eq(montagens.status, "montada")));

  if (!nova) {
    return { erro: "Essa montagem não está disponível — confira se ela já está em outro carro." };
  }
  if (nova.carroId) return { erro: "Essa montagem já está instalada em outro carro." };

  await db.insert(movimentos).values({
    itemId: nova.itemId,
    tipo: "saida_producao",
    quantidade: 1,
    referencia: nova.numero,
    usuarioId: sessao.id,
    observacao: `Instalada no carro ${carro.placa}`,
    montagemId: nova.id,
  });

  const [depois] = await db
    .update(montagens)
    .set({ status: "instalada", carroId, local: carro.placa })
    .where(eq(montagens.id, montagemId))
    .returning();

  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: montagemId,
    acao: "atualizar",
    antes: nova,
    depois,
  });

  revalidarTudo();
  return {};
}

export async function atualizarLocalDaMontagem(
  id: string,
  local: string,
): Promise<{ erro?: string }> {
  const sessao = await exigirEdicao();

  const [montagem] = await db.select().from(montagens).where(eq(montagens.id, id));
  if (!montagem) return { erro: "Montagem não encontrada." };
  if (montagem.carroId) {
    return { erro: "Enquanto estiver instalada, o local é a placa do carro." };
  }

  await db.update(montagens).set({ local: local.trim() || null }).where(eq(montagens.id, id));
  await registrar({
    usuarioId: sessao.id,
    tabela: "montagens",
    registroId: id,
    acao: "atualizar",
    antes: { local: montagem.local },
    depois: { local: local.trim() || null },
  });

  revalidatePath("/estrutura");
  revalidatePath("/carros");
  return {};
}

/* Montagem mexe em estoque, em item e no painel: as quatro telas envelhecem
   juntas e não adianta revalidar só a de onde veio o clique. */
function revalidarTudo() {
  revalidatePath("/estrutura");
  revalidatePath("/estoque");
  revalidatePath("/itens");
  revalidatePath("/carros");
  revalidatePath("/");
}
