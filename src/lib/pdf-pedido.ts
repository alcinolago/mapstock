/**
 * O pedido de compra em PDF, do jeito que quem compra precisa receber.
 *
 * A folha nao e um espelho da tela: quem compra nao esta no sistema e nao vai
 * abrir o cadastro do item para descobrir em qual loja e qual variacao. Entao
 * cada linha leva junto o link do produto, o SKU do fornecedor, a quantidade
 * minima e — o que motivou tudo isso — os parametros de compra escritos a
 * mao, porque no site do fornecedor o mesmo produto tem dez variacoes e so
 * uma delas serve.
 *
 * Separado da rota de proposito: montar a folha nao depende de requisicao
 * nenhuma, e assim da para gerar o arquivo num script e conferir o resultado.
 */

import type { LinhaPedidoCompleta, PedidoCompleto } from "@/db/consultas";
import { STATUS_PEDIDO } from "@/lib/labels";
import { linkRota } from "@/lib/mapa";
import { CORES, Folha, nomeArquivoPdf } from "@/lib/pdf";
import { data, dataHora, moeda, numero } from "@/lib/utils";

export async function montarPdfDoPedido({ pedido, linhas, fotos }: PedidoCompleto) {
  const subtotal = linhas.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);
  const total = subtotal + pedido.frete;

  const folha = await Folha.criar({
    titulo: `Pedido de compra ${pedido.numero} — ${pedido.fornecedor}`,
    autor: "MapStock — Mapzer",
    assunto: "Pedido de compra",
  });

  /* ------------------------------------------------------------ Cabecalho */

  folha.texto("MAPSTOCK · MAPZER", { tamanho: 8, negrito: true, cor: CORES.marca });
  folha.espaco(2);
  folha.titulo(`Pedido de compra ${pedido.numero}`);
  folha.texto(
    [
      `Emitido em ${data(pedido.criadoEm)}`,
      pedido.criadoPor ? `por ${pedido.criadoPor}` : null,
      `Situação: ${STATUS_PEDIDO[pedido.status]}`,
      pedido.cotacaoNumero ? `Origem: cotação ${pedido.cotacaoNumero}` : null,
    ]
      .filter(Boolean)
      .join("  ·  "),
    { tamanho: 9, cor: CORES.fraco },
  );

  /* ---------------------------------------------------------- Fornecedor  */

  folha.secao("Fornecedor");
  folha.texto(pedido.fornecedor, { tamanho: 12, negrito: true });
  folha.espaco(4);
  folha.campos([
    ["Contato", pedido.fornecedorContato],
    ["Telefone", pedido.fornecedorTelefone],
    ["E-mail", pedido.fornecedorEmail],
    ["Endereço", pedido.fornecedorEndereco],
    ["Condição de pagamento", pedido.condicaoPagamento],
    ["Frete do pedido", pedido.frete > 0 ? moeda(pedido.frete) : null],
    ["Frete combinado", pedido.fornecedorFrete],
  ]);

  /* O endereco ja saiu escrito acima; o link e para quem abrir o PDF no
     celular e sair dirigindo, sem copiar o texto na mao. Fornecedor online
     nao tem endereco, e ai nao aparece nada. */
  const rota = linkRota(pedido.fornecedorEndereco);
  if (rota) {
    folha.texto("COMO CHEGAR", { tamanho: 7.5, negrito: true, cor: CORES.fraco });
    folha.link("Abrir a rota no Google Maps", rota);
    folha.espaco(4);
  }

  if (pedido.fornecedorSite) {
    folha.texto("SITE DO FORNECEDOR", { tamanho: 7.5, negrito: true, cor: CORES.fraco });
    folha.link(pedido.fornecedorSite, pedido.fornecedorSite);
    folha.espaco(4);
  }

  if (pedido.fornecedorObservacoes) {
    folha.caixa("Observações do fornecedor", pedido.fornecedorObservacoes);
  }

  if (pedido.observacoes) {
    folha.caixa("Observações do pedido", pedido.observacoes);
  }

  /* --------------------------------------------------------------- Itens  */

  folha.secao(`Itens a comprar (${linhas.length})`);

  for (const [indice, linha] of linhas.entries()) {
    /* Um item nunca comeca no pe da folha: se nao cabe o cabecalho dele mais
       algumas linhas, ja vai inteiro para a proxima pagina. */
    folha.garantir(120);

    folha.texto(`${indice + 1}. ${linha.codigo}`, { tamanho: 11, negrito: true });
    folha.texto(linha.descricao, { tamanho: 10, cor: CORES.suave });
    folha.espaco(6);

    /* A foto vem logo abaixo do codigo, antes dos campos: quem compra olha a
       peca primeiro e so depois confere a quantidade. */
    const foto = fotos.get(linha.itemId);
    if (foto) {
      await folha.imagem(new Uint8Array(foto), 90);
      folha.espaco(8);
    }

    folha.campos([
      ["Quantidade a comprar", `${numero(linha.quantidade)} ${linha.unidade}`],
      ["Preço unitário de referência", moeda(linha.precoUnitario)],
      ["Total estimado da linha", moeda(linha.quantidade * linha.precoUnitario)],
      ["Já recebido", linha.recebida > 0 ? `${numero(linha.recebida)} ${linha.unidade}` : null],
      ["Código do produto no fornecedor", linha.sku],
      [
        "Quantidade mínima do fornecedor",
        (linha.qtdMinima ?? 0) > 0
          ? `${numero(linha.qtdMinima)} ${linha.unidadeMinima ?? linha.unidade}`
          : null,
      ],
      ["Prazo de entrega", prazo(linha)],
      ["Preço de tabela do fornecedor", (linha.precoTabela ?? 0) > 0 ? moeda(linha.precoTabela) : null],
      ["Classificação", linha.classificacao],
      ["Tipo de aquisição", linha.aquisicao],
      ["Origem", linha.origemFabricacao],
      ["Onde guardar na chegada", linha.localizacao],
      ["Estoque atual", `${numero(linha.fisico - linha.reservado)} ${linha.unidade}`],
      [
        "Estoque mínimo",
        linha.estoqueMinimo > 0 ? `${numero(linha.estoqueMinimo)} ${linha.unidade}` : null,
      ],
    ]);

    /* O link do vinculo com este fornecedor vem primeiro: e a pagina exata do
       produto na loja dele. O do cadastro e a referencia geral do item. */
    if (linha.linkFornecedor) {
      folha.texto("PÁGINA DO PRODUTO NESTE FORNECEDOR", {
        tamanho: 7.5,
        negrito: true,
        cor: CORES.fraco,
      });
      folha.link(linha.linkFornecedor, linha.linkFornecedor);
      folha.espaco(4);
    }

    if (linha.linkCompra && linha.linkCompra !== linha.linkFornecedor) {
      folha.texto("LINK DE COMPRA DO CADASTRO", {
        tamanho: 7.5,
        negrito: true,
        cor: CORES.fraco,
      });
      folha.link(linha.linkCompra, linha.linkCompra);
      folha.espaco(4);
    }

    if (linha.parametrosCompra) {
      folha.caixa("O que escolher no site (parâmetros de compra)", linha.parametrosCompra, "destaque");
    }

    if (linha.observacoesFornecedor) {
      folha.caixa(`Observações do vínculo com ${pedido.fornecedor}`, linha.observacoesFornecedor);
    }

    if (linha.observacoesItem) {
      folha.caixa("Observações do item", linha.observacoesItem);
    }

    if (linha.fichaTecnica) {
      folha.caixa("Ficha técnica", linha.fichaTecnica);
    }

    const impressao = [
      linha.material3d && `Material ${linha.material3d}`,
      linha.alturaCamada3d && `camada ${linha.alturaCamada3d} mm`,
      linha.preenchimento3d && `preenchimento ${linha.preenchimento3d}`,
      linha.pesoEstimado3d && `peso estimado ${linha.pesoEstimado3d} g`,
    ].filter(Boolean);

    if (impressao.length > 0) {
      folha.caixa("Parâmetros de impressão 3D", impressao.join(" · "));
    }

    folha.espaco(4);
    folha.divisoria();
  }

  /* -------------------------------------------------------------- Resumo  */

  folha.secao("Resumo");
  folha.campos(
    [
      ["Itens", String(linhas.length)],
      ["Subtotal", moeda(subtotal)],
      ["Frete", moeda(pedido.frete)],
      ["Total estimado", moeda(total)],
    ],
    4,
  );
  folha.espaco(4);
  folha.texto(
    "Valores de referência, tirados da última cotação. Divergência de preço no site é esperada — " +
      "confirme com quem pediu antes de fechar a compra.",
    { tamanho: 8.5, cor: CORES.fraco },
  );

  const arquivo = nomeArquivoPdf(`pedido_${pedido.numero}_${pedido.fornecedor}`);
  const bytes = await folha.bytes(
    `MapStock · Pedido ${pedido.numero} · ${pedido.fornecedor} · gerado em ${dataHora(new Date())}`,
  );

  return { bytes, arquivo };
}

function prazo(linha: LinhaPedidoCompleta): string | null {
  if ((linha.prazoFornecedor ?? 0) > 0) {
    return `${numero(linha.prazoFornecedor)} ${linha.prazoFornecedorUnidade}`;
  }
  if (linha.prazoItem > 0) return `${numero(linha.prazoItem)} ${linha.prazoItemUnidade}`;
  return null;
}
