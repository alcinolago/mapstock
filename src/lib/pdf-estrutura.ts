/**
 * A estrutura em PDF, para imprimir e levar para a bancada.
 *
 * Quem está montando nem sempre tem o sistema à mão, então a folha sai com a
 * árvore inteira aberta — divisões, peças e o que está dentro de cada
 * conjunto —, ao contrário da tela, que nasce recolhida. Na tela quem quer o
 * detalhe clica; no papel não tem onde clicar.
 *
 * As quantidades seguem a regra da tela: o que está dentro de um conjunto é a
 * receita de *um* conjunto, sem multiplicar pelo nível de cima. A folha tem
 * que dizer a mesma coisa que o sistema, e a legenda avisa isso.
 */

import type { NoMolde } from "@/components/moldes/arvore-molde";
import type { MoldeNaTela } from "@/components/moldes/painel-moldes";
import { CORES, Folha, nomeArquivoPdf, type Celula } from "@/lib/pdf";
import { data, dataHora, moeda, numero } from "@/lib/utils";

/* Soma 511pt, a largura util da A4 com as margens de pdf.ts. */
const COLUNAS = { codigo: 72, descricao: 279, quantidade: 60, local: 100 };

/* Quanto cada nivel da arvore entra para a direita. */
const RECUO_NIVEL = 12;

export async function montarPdfDaEstrutura(molde: MoldeNaTela, emitidoPor: string) {
  const ehConjunto = Boolean(molde.itemId);
  const pecas = contar(molde.nos);

  const folha = await Folha.criar({
    titulo: `Estrutura — ${molde.nome}`,
    autor: "MapStock — Mapzer",
    assunto: ehConjunto ? "Estrutura de item" : "Estrutura de equipamento",
  });

  /* ------------------------------------------------------------ Cabecalho */

  folha.texto("MAPSTOCK · MAPZER", { tamanho: 8, negrito: true, cor: CORES.marca });
  folha.espaco(2);
  folha.titulo(molde.nome);
  folha.texto(
    [
      ehConjunto ? "Estrutura de item" : "Estrutura de equipamento",
      `Emitida em ${data(new Date())}`,
      `por ${emitidoPor}`,
      molde.ativo ? null : "Inativa",
    ]
      .filter(Boolean)
      .join("  ·  "),
    { tamanho: 9, cor: CORES.fraco },
  );
  folha.espaco(6);

  folha.campos(
    [
      ["Item produzido", ehConjunto ? `${molde.codigo} — ${molde.itemDescricao}` : null],
      ["Divisões", String(pecas.divisoes)],
      ["Peças", String(pecas.pecas)],
      ["Custo estimado", molde.custoTotal > 0 ? moeda(molde.custoTotal) : null],
    ],
    ehConjunto ? 2 : 3,
  );

  if (molde.descricao) folha.caixa("Descrição", molde.descricao);

  /* -------------------------------------------------------------- Arvore  */

  folha.secao("Estrutura");
  folha.texto(
    "Quantidades por unidade do nível de cima: o que está dentro de um conjunto é o que entra em um conjunto.",
    { tamanho: 8, cor: CORES.fraco },
  );
  folha.espaco(4);

  cabecalhoTabela(folha);
  for (const no of molde.nos) linhas(folha, no, 0);

  const arquivo = nomeArquivoPdf(`estrutura_${molde.nome}`);
  const bytes = await folha.bytes(
    `MapStock · Estrutura ${molde.nome} · gerada em ${dataHora(new Date())}`,
  );

  return { bytes, arquivo };
}

function cabecalhoTabela(folha: Folha) {
  const estilo = { tamanho: 7.5, negrito: true, cor: CORES.fraco };
  folha.linhaTabela(
    [
      { texto: "CÓDIGO", largura: COLUNAS.codigo, ...estilo },
      { texto: "DESCRIÇÃO", largura: COLUNAS.descricao, ...estilo },
      { texto: "QTD.", largura: COLUNAS.quantidade, alinhar: "direita", ...estilo },
      { texto: "LOCAL DE MONTAGEM", largura: COLUNAS.local, ...estilo },
    ],
    { fundo: CORES.fundoSuave },
  );
}

function linhas(folha: Folha, no: NoMolde, nivel: number) {
  const recuo = nivel * RECUO_NIVEL;
  const ehDivisao = !no.itemId;

  const celulas: Celula[] = ehDivisao
    ? [
        { texto: "", largura: COLUNAS.codigo },
        {
          texto: no.nome ?? "",
          largura: COLUNAS.descricao,
          negrito: true,
          recuo,
        },
        {
          texto: `${numero(no.quantidade)} ×`,
          largura: COLUNAS.quantidade,
          alinhar: "direita",
          cor: CORES.suave,
        },
        { texto: no.localMontagem ?? "", largura: COLUNAS.local, tamanho: 8.5, cor: CORES.suave },
      ]
    : [
        { texto: no.codigo ?? "", largura: COLUNAS.codigo, negrito: true, tamanho: 8.5 },
        {
          texto: no.ehConjunto ? `${no.descricao ?? ""} (conjunto)` : (no.descricao ?? ""),
          largura: COLUNAS.descricao,
          negrito: no.ehConjunto,
          recuo,
        },
        {
          texto: `${numero(no.quantidade)} ${no.unidade ?? ""}`.trim(),
          largura: COLUNAS.quantidade,
          alinhar: "direita",
          negrito: true,
        },
        { texto: no.localMontagem ?? "", largura: COLUNAS.local, tamanho: 8.5, cor: CORES.suave },
      ];

  /* Tabela que continua na folha seguinte leva o cabecalho junto: sem ele,
     a pagina 3 impressa e solta na bancada vira uma lista de numeros. */
  if (folha.garantir(folha.alturaLinha(celulas))) cabecalhoTabela(folha);
  folha.linhaTabela(celulas, { fundo: ehDivisao ? CORES.fundoSuave : undefined });

  for (const f of no.filhos) linhas(folha, f, nivel + 1);
}

function contar(nos: NoMolde[]): { divisoes: number; pecas: number } {
  return nos.reduce(
    (total, no) => {
      const dentro = contar(no.filhos);
      return {
        divisoes: total.divisoes + (no.itemId ? 0 : 1) + dentro.divisoes,
        pecas: total.pecas + (no.itemId ? 1 : 0) + dentro.pecas,
      };
    },
    { divisoes: 0, pecas: 0 },
  );
}
