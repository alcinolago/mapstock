/**
 * A solicitação de cotação em PDF — o documento que sai daqui e vai para os
 * fornecedores pedindo preço.
 *
 * É o contrário do PDF do pedido, e a diferença não é de estilo: o do pedido
 * vai para um fornecedor só, já decidido, e por isso carrega preço, SKU e o
 * link da loja dele. Este aqui vai para vários ao mesmo tempo, que estão
 * competindo entre si. Então ele não pode conter:
 *
 * - nome de fornecedor nenhum, nem o vínculo do item com um deles;
 * - preço, total, preço de tabela ou qualquer número em dinheiro;
 * - link de loja, SKU ou o que aponte para onde já se compra.
 *
 * Qualquer um desses contaria a um fornecedor com quem ele está competindo,
 * ou por quanto — e é justamente o que se está tentando descobrir.
 *
 * O que fica é a peça: código, descrição, quantidade, foto e especificação.
 *
 * E só isso. Não há campo em branco para o fornecedor preencher nem instrução
 * de como responder: cada um usa o próprio sistema e devolve o orçamento no
 * documento que o sistema dele gera. Linha pontilhada para preencher à mão
 * seria estorvo numa folha que ninguém vai preencher à mão.
 *
 * Separado da rota de propósito, como o do pedido: montar a folha não depende
 * de requisição nenhuma, e assim dá para gerar o arquivo num script.
 */

import type { CotacaoParaPdf } from "@/db/consultas";
import { CORES, Folha, nomeArquivoPdf } from "@/lib/pdf";
import { data, dataHora, numero } from "@/lib/utils";

export async function montarPdfDaCotacao({ cotacao, linhas, fotos }: CotacaoParaPdf) {
  const folha = await Folha.criar({
    titulo: `Solicitação de cotação ${cotacao.numero}`,
    autor: "MapStock — Mapzer",
    assunto: "Solicitação de cotação",
  });

  /* ------------------------------------------------------------ Cabeçalho */

  folha.texto("MAPSTOCK · MAPZER", { tamanho: 8, negrito: true, cor: CORES.marca });
  folha.espaco(2);
  folha.titulo(`Solicitação de cotação ${cotacao.numero}`);
  folha.texto(cotacao.titulo, { tamanho: 11, cor: CORES.suave });
  folha.espaco(4);
  folha.texto(
    [`Emitida em ${data(cotacao.criadoEm)}`, cotacao.criadoPor ? `por ${cotacao.criadoPor}` : null]
      .filter(Boolean)
      .join("  ·  "),
    { tamanho: 9, cor: CORES.fraco },
  );

  /* ---------------------------------------------------------------- Itens */

  folha.secao(`Itens para cotar (${linhas.length})`);

  if (linhas.length === 0) {
    folha.texto("Esta cotação ainda não tem itens.", { tamanho: 9.5, cor: CORES.fraco });
  }

  for (const [indice, linha] of linhas.entries()) {
    /* Um item nunca começa no pé da folha: se não cabe o cabeçalho dele mais
       os campos de resposta, já vai inteiro para a próxima página. */
    folha.garantir(150);

    folha.texto(`${indice + 1}. ${linha.codigo}`, { tamanho: 11, negrito: true });
    folha.texto(linha.descricao, { tamanho: 10, cor: CORES.suave });
    folha.espaco(6);

    /* A foto antes dos campos: quem vai cotar reconhece a peça primeiro e só
       depois olha a quantidade. */
    const foto = fotos.get(linha.itemId);
    if (foto) {
      await folha.imagem(new Uint8Array(foto), 90);
      folha.espaco(8);
    }

    folha.campos([["Quantidade", `${numero(linha.quantidade)} ${linha.unidade}`]]);

    if (linha.fichaTecnica) {
      folha.caixa("Especificação", linha.fichaTecnica);
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

  /* A folha acaba na última peça. Não há resumo: somar quantidade não diz
     nada, e valor é exatamente o que não pode estar aqui. */

  const arquivo = nomeArquivoPdf(`cotacao_${cotacao.numero}`);
  const bytes = await folha.bytes(
    `MapStock · Solicitação de cotação ${cotacao.numero} · gerada em ${dataHora(new Date())}`,
  );

  return { bytes, arquivo };
}
