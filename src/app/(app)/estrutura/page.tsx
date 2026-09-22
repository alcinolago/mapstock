import { asc, eq } from "drizzle-orm";

import { PainelMoldes, type MoldeNaTela } from "@/components/moldes/painel-moldes";
import type { NoMolde } from "@/components/moldes/arvore-molde";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import {
  fotosPrincipais,
  listarItensComSaldo,
  listarMoldes,
  nosDoMolde,
  type NoDoMolde,
} from "@/db/consultas";
import { divisoes } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Estrutura" };

/**
 * Monta a arvore de um molde, abrindo os kits que aparecem dentro dela.
 *
 * O equipamento e um manual: ele aponta para o item "Domo", e quem diz o que
 * tem dentro de um domo e a estrutura do domo, na secao Itens. Sem abrir essa
 * arvore, o manual mostra uma linha unica e nao serve para quem esta na
 * bancada querendo ver o equipamento inteiro ate o ultimo parafuso.
 *
 * O que vem de dentro do kit vai marcado com `doKit`, e a tela nao oferece
 * botao nenhum nessas linhas. A alteracao e sempre na estrutura do proprio
 * item — editar por dois lugares e como um deles fica errado.
 *
 * As quantidades sao as da receita do kit, sem multiplicar pela quantidade do
 * pai: o bloco e copia fiel do que esta na secao Itens, que e para onde a
 * pessoa vai quando quiser mudar. Multiplicar faria os dois discordarem.
 *
 * O custo sobe junto: um kit nunca foi comprado, entao o preco dele e zero e
 * o equipamento somaria o domo como nada. Com a arvore aberta, o no do kit
 * passa a valer a soma do que entra nele.
 */
function emArvore(
  moldeId: string,
  paiId: string | null,
  planas: Map<string, NoDoMolde[]>,
  kits: Map<string, string>,
  doKit: boolean,
  /* Kit dentro de kit e normal; kit dentro de si mesmo nao deveria existir,
     mas dado antigo nao pode travar a tela num laco infinito. */
  visitados: Set<string>,
): NoMolde[] {
  return (planas.get(moldeId) ?? [])
    .filter((n) => n.paiId === paiId)
    .map((n) => {
      const moldeDoKit = n.itemId ? kits.get(n.itemId) : undefined;
      const abreKit = Boolean(moldeDoKit && !visitados.has(moldeDoKit));

      const filhos = abreKit
        ? emArvore(moldeDoKit!, null, planas, kits, true, new Set(visitados).add(moldeDoKit!))
        : emArvore(moldeId, n.id, planas, kits, doKit, visitados);

      /* Peca folha vale o proprio custo; divisao e kit valem o que esta
         dentro deles. */
      const proprio = n.itemId && filhos.length === 0 ? n.custo * n.quantidade : 0;
      const dosFilhos = filhos.reduce((t, f) => t + f.custoTotal, 0);

      return {
        id: n.id,
        nome: n.nome,
        itemId: n.itemId,
        codigo: n.codigo,
        descricao: n.descricao,
        unidade: n.unidade,
        quantidade: n.quantidade,
        localMontagem: n.localMontagem,
        disponivel: n.disponivel,
        custoTotal: proprio + dosFilhos * n.quantidade,
        ehKit: Boolean(moldeDoKit),
        doKit,
        filhos,
      };
    });
}

export default async function PaginaEstrutura() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const [lista, listaDivisoes, itens] = await Promise.all([
    listarMoldes(),
    db.select().from(divisoes).where(eq(divisoes.ativo, true)).orderBy(asc(divisoes.ordem)),
    listarItensComSaldo(),
  ]);

  /* Todas as arvores de uma vez: a expansao de um kit precisa da arvore de
     outro molde, entao buscar sob demanda dentro da recursao viraria uma ida
     ao banco por no. Sao poucos moldes. */
  const planas = new Map<string, NoDoMolde[]>(
    await Promise.all(lista.map(async (m) => [m.id, await nosDoMolde(m.id)] as const)),
  );

  /* item -> estrutura que o produz. E este mapa que faz o manual reconhecer
     que aquela linha nao e uma peca qualquer, e sim um kit com receita. */
  const kits = new Map(
    lista.filter((m) => m.itemId).map((m) => [m.itemId!, m.id] as const),
  );

  const comArvore: MoldeNaTela[] = await Promise.all(
    lista.map(async (m) => {
      const nos = emArvore(m.id, null, planas, kits, false, new Set([m.id]));
      return {
        id: m.id,
        nome: m.nome,
        descricao: m.descricao,
        ativo: m.ativo,
        montagens: m.montagens,
        itemId: m.itemId,
        codigo: m.codigo,
        itemDescricao: m.itemDescricao,
        unidade: m.unidade,
        emEstoque: m.emEstoque,
        custoTotal: nos.reduce((t, n) => t + n.custoTotal, 0),
        nos,
      };
    }),
  );

  const fotos = await fotosPrincipais(itens.map((i) => i.id));

  const selecionaveis = itens.map((i) => ({
    id: i.id,
    codigo: i.codigo,
    descricao: i.descricao,
    unidade: i.unidade,
    disponivel: i.disponivel,
    fotoId: fotos.get(i.id),
  }));

  /* Um item tem uma receita so: o que ja virou kit sai da lista de escolha. */
  const comEstrutura = new Set(lista.map((m) => m.itemId).filter(Boolean) as string[]);

  return (
    <>
      <CabecalhoPagina
        titulo="Estrutura"
        descricao="Em cima, o manual do equipamento completo. Embaixo, os itens que são montados a partir de outros — esses vão para a Montagem."
      />

      <PainelMoldes
        moldes={comArvore}
        divisoes={listaDivisoes.map((d) => ({ id: d.id, nome: d.nome }))}
        itens={selecionaveis}
        itensSemEstrutura={selecionaveis.filter((i) => !comEstrutura.has(i.id))}
        podeEditar={podeEditar}
      />
    </>
  );
}
