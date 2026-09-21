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
 * Mais os campos em branco para ele preencher e devolver, que é o que faz a
 * folha valer como orçamento de volta.
 *
 * Separado da rota de propósito, como o do pedido: montar a folha não depende
 * de requisição nenhuma, e assim dá para gerar o arquivo num script.
 */

import type { CotacaoParaPdf } from "@/db/consultas";
import { CORES, Folha, nomeArquivoPdf } from "@/lib/pdf";
import { data, dataHora, numero } from "@/lib/utils";

/* Linha para preencher a mão. Underscore está na WinAnsi, ao contrário de um
   traço longo repetido, e imprime igual em qualquer leitor. */
const PREENCHER = "____________________";

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

  folha.caixa(
    "Como responder",
    "Preencha, para cada item, o preço unitário e o prazo de entrega, e devolva este " +
      "documento preenchido. No fim da folha há um espaço para os seus dados e para as " +
      "condições da proposta. Havendo dúvida sobre especificação ou quantidade, fale com " +
      "quem enviou antes de cotar.",
    "destaque",
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

    folha.campos(
      [
        ["Quantidade", `${numero(linha.quantidade)} ${linha.unidade}`],
        ["Preço unitário", PREENCHER],
        ["Prazo de entrega", PREENCHER],
      ],
      3,
    );

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

  /* ------------------------------------------------------------- Resposta */

  /* Sem total nenhum, nem somando as quantidades em dinheiro: o fechamento da
     folha é o espaço da resposta, não um resumo de valores que não existem. */
  folha.garantir(170);
  folha.secao("Dados da proposta — preencher");

  folha.campos(
    [
      ["Fornecedor", PREENCHER],
      ["Contato", PREENCHER],
      ["Telefone / e-mail", PREENCHER],
      ["Validade da proposta", PREENCHER],
      ["Condição de pagamento", PREENCHER],
      ["Frete", PREENCHER],
    ],
    2,
  );

  folha.espaco(6);
  folha.caixa("Observações do fornecedor", "\n\n\n");

  const arquivo = nomeArquivoPdf(`cotacao_${cotacao.numero}`);
  const bytes = await folha.bytes(
    `MapStock · Solicitação de cotação ${cotacao.numero} · gerada em ${dataHora(new Date())}`,
  );

  return { bytes, arquivo };
}
