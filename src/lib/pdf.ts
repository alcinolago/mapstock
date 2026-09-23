/**
 * Montagem de PDF em A4: um punhado de funcoes
 * que resolvem os detalhes chatos uma vez so.
 *
 * Tres coisas que decidem se o arquivo abre certo do outro lado:
 *
 * 1. Quebra de linha e de pagina calculada na mao. O pdf-lib desenha texto
 *    numa coordenada, nao tem fluxo: quem nao mede a largura da fonte estoura
 *    a margem e perde o fim da frase.
 * 2. Acento. A fonte padrao usa a tabela WinAnsi; caractere fora dela faz o
 *    pdf-lib lancar erro no meio da geracao e o download falha inteiro. Por
 *    isso todo texto passa por higienizar() antes de ser desenhado.
 * 3. Link clicavel e anotacao, nao texto azul. Sem a anotacao o comprador
 *    teria que digitar a URL da AliExpress a mao.
 */

import {
  PDFDocument,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

/* Cor literal aqui e proposital: PDF nao tem tema claro e escuro, entao os
   tokens de globals.css nao valem. Os valores espelham o tema claro. */
export const CORES = {
  texto: rgb(0.06, 0.09, 0.16),
  suave: rgb(0.28, 0.33, 0.41),
  fraco: rgb(0.39, 0.45, 0.55),
  marca: rgb(0.01, 0.52, 0.78),
  borda: rgb(0.85, 0.88, 0.92),
  bordaForte: rgb(0.76, 0.81, 0.87),
  fundoSuave: rgb(0.97, 0.98, 0.99),
  destaque: rgb(0.99, 0.95, 0.78),
  destaqueBorda: rgb(0.71, 0.33, 0.04),
} satisfies Record<string, RGB>;

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 42;
const RODAPE = 48;
/* O fio do rodape fica 12pt acima do texto dele; o conteudo para antes do
   fio, senao a ultima linha de uma tabela encosta nele. */
const FIM_DO_CONTEUDO = RODAPE + 18;

/* Caracteres que a tabela WinAnsi nao tem, mas que aparecem o tempo todo em
   ficha tecnica copiada de site. Trocar e melhor do que sumir. */
const TROCAS: [RegExp, string][] = [
  [/[≥]/g, ">="],
  [/[≤]/g, "<="],
  [/[≠]/g, "!="],
  [/[→➔]/g, "->"],
  [/[≈]/g, "~"],
  /* Escritos pelo codigo do caractere, nao pelo caractere: espaco nao
     separavel e separador de linha sao invisiveis no editor e se perdem em
     qualquer edicao descuidada. */
  [new RegExp(`[${String.fromCharCode(0xa0)}\\t]`, "g"), " "],
  [new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, "g"), "\n"],
];

/* Alem do Latin-1, a WinAnsi tem esta faixa de simbolos tipograficos. */
const EXTRAS_WINANSI = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function higienizar(texto: string): string {
  let limpo = texto;
  for (const [de, para] of TROCAS) limpo = limpo.replace(de, para);

  return [...limpo]
    .filter((c) => {
      const cod = c.codePointAt(0)!;
      if (c === "\n") return true;
      if (cod >= 0x20 && cod <= 0x7e) return true;
      if (cod >= 0xa1 && cod <= 0xff) return true;
      return EXTRAS_WINANSI.includes(c);
    })
    .join("");
}

/*
 * O que precisa virar %XX numa URL, sem mexer no que ja veio escapado.
 *
 * Era um encodeURI direto, que serve para o site digitado a mao ("loja.com/
 * peças e coisas") mas destroi URL montada por codigo: o link de rota do
 * fornecedor chega com %20 no endereco, e o encodeURI o transformava em
 * %2520 — o Maps abriria buscando o texto literal "Av.%20Brasil".
 *
 * O `%` so e escapado quando nao inicia um par hexadecimal de verdade.
 */
const INSEGURO_NA_URL = /%(?![0-9A-Fa-f]{2})|[^\x21-\x7E]|["<>\\^`{|}]/g;

function urlDeLink(url: string): string {
  return url.replace(INSEGURO_NA_URL, (c) => encodeURIComponent(c));
}

type OpcoesTexto = {
  tamanho?: number;
  negrito?: boolean;
  cor?: RGB;
  recuo?: number;
  largura?: number;
  entrelinha?: number;
};

/** Folga entre o texto e a borda de cada celula de tabela. */
const PREENCHIMENTO = 4;

export type Celula = {
  texto: string;
  largura: number;
  alinhar?: "direita";
  negrito?: boolean;
  cor?: RGB;
  tamanho?: number;
  /** Recuo dentro da celula — e o que desenha os niveis da arvore. */
  recuo?: number;
};

export class Folha {
  private doc!: PDFDocument;
  private pagina!: PDFPage;
  private normal!: PDFFont;
  private forte!: PDFFont;
  private y = 0;

  static async criar(meta: {
    titulo: string;
    autor: string;
    assunto?: string;
  }): Promise<Folha> {
    const folha = new Folha();
    folha.doc = await PDFDocument.create();
    folha.doc.setTitle(higienizar(meta.titulo));
    folha.doc.setAuthor(higienizar(meta.autor));
    folha.doc.setProducer("MapStock");
    folha.doc.setCreator("MapStock");
    if (meta.assunto) folha.doc.setSubject(higienizar(meta.assunto));
    folha.normal = await folha.doc.embedFont(StandardFonts.Helvetica);
    folha.forte = await folha.doc.embedFont(StandardFonts.HelveticaBold);
    folha.novaPagina();
    return folha;
  }

  /** Largura util: a folha menos as duas margens. */
  get largura(): number {
    return A4.largura - MARGEM * 2;
  }

  private novaPagina() {
    this.pagina = this.doc.addPage([A4.largura, A4.altura]);
    this.y = A4.altura - MARGEM;
  }

  /**
   * Abre outra pagina se o que vem a seguir nao cabe no que sobrou. Diz se
   * abriu, para quem precisa repetir um cabecalho de tabela no topo.
   */
  garantir(altura: number): boolean {
    if (this.y - altura >= FIM_DO_CONTEUDO) return false;
    this.novaPagina();
    return true;
  }

  espaco(altura: number) {
    this.y -= altura;
  }

  private fonte(negrito?: boolean) {
    return negrito ? this.forte : this.normal;
  }

  /**
   * Quebra o texto na largura disponivel. Palavra sozinha maior que a linha
   * (uma URL da AliExpress, sempre) e cortada na forca — sem isso ela
   * atravessaria a margem direita e parte dela se perderia fora da folha.
   */
  private quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number) {
    const linhas: string[] = [];

    for (const paragrafo of higienizar(texto).split("\n")) {
      let atual = "";

      for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
        const tentativa = atual ? `${atual} ${palavra}` : palavra;
        if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
          atual = tentativa;
          continue;
        }

        if (atual) linhas.push(atual);
        atual = palavra;

        while (fonte.widthOfTextAtSize(atual, tamanho) > largura) {
          let corte = atual.length;
          while (corte > 1 && fonte.widthOfTextAtSize(atual.slice(0, corte), tamanho) > largura) {
            corte -= 1;
          }
          linhas.push(atual.slice(0, corte));
          atual = atual.slice(corte);
        }
      }

      linhas.push(atual);
    }

    return linhas;
  }

  /** Altura que este texto vai ocupar, sem desenhar nada. */
  private alturaDe(texto: string, o: OpcoesTexto) {
    const tamanho = o.tamanho ?? 9.5;
    const largura = o.largura ?? this.largura - (o.recuo ?? 0);
    const linhas = this.quebrar(texto, this.fonte(o.negrito), tamanho, largura);
    return linhas.length * tamanho * (o.entrelinha ?? 1.38);
  }

  texto(texto: string, o: OpcoesTexto = {}) {
    const tamanho = o.tamanho ?? 9.5;
    const fonte = this.fonte(o.negrito);
    const recuo = o.recuo ?? 0;
    const largura = o.largura ?? this.largura - recuo;
    const altura = tamanho * (o.entrelinha ?? 1.38);

    for (const linha of this.quebrar(texto, fonte, tamanho, largura)) {
      this.garantir(altura);
      this.y -= altura;
      this.pagina.drawText(linha, {
        x: MARGEM + recuo,
        y: this.y + altura - tamanho,
        size: tamanho,
        font: fonte,
        color: o.cor ?? CORES.texto,
      });
    }
  }

  /**
   * Desenha uma imagem alinhada a margem esquerda, respeitando o fluxo.
   *
   * So JPEG: e o que o pdf-lib embute (JPEG e PNG), e e por causa disso que a
   * foto do item e guardada em JPEG desde o navegador.
   */
  async imagem(bytes: Uint8Array, larguraMaxima: number) {
    const imagem = await this.doc.embedJpg(bytes);
    const escala = Math.min(1, larguraMaxima / imagem.width);
    const largura = imagem.width * escala;
    const altura = imagem.height * escala;

    this.garantir(altura);
    this.y -= altura;
    this.pagina.drawImage(imagem, { x: MARGEM, y: this.y, width: largura, height: altura });
  }

  titulo(texto: string) {
    this.texto(texto, { tamanho: 17, negrito: true });
    this.espaco(4);
  }

  /** Cabecalho de secao: rotulo em caixa alta com um fio embaixo. */
  secao(texto: string) {
    this.garantir(30);
    this.espaco(10);
    this.texto(texto.toUpperCase(), { tamanho: 8.5, negrito: true, cor: CORES.fraco });
    this.espaco(2);
    this.divisoria();
    this.espaco(5);
  }

  divisoria(cor: RGB = CORES.borda) {
    this.garantir(6);
    this.y -= 3;
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y },
      end: { x: A4.largura - MARGEM, y: this.y },
      thickness: 0.7,
      color: cor,
    });
    this.y -= 3;
  }

  /**
   * Grade de rotulo/valor. Duas colunas por padrao — e o formato que cabe a
   * ficha inteira de um item numa folha sem virar parede de texto.
   */
  campos(pares: [string, string | null | undefined][], colunas = 2) {
    const visiveis = pares.filter(([, valor]) => valor != null && String(valor).trim() !== "");
    if (visiveis.length === 0) return;

    const vao = 14;
    const largura = (this.largura - vao * (colunas - 1)) / colunas;

    for (let inicio = 0; inicio < visiveis.length; inicio += colunas) {
      const linha = visiveis.slice(inicio, inicio + colunas);

      const alturas = linha.map(
        ([rotulo, valor]) =>
          this.alturaDe(rotulo, { tamanho: 7.5, negrito: true, largura }) +
          this.alturaDe(String(valor), { tamanho: 9.5, largura }),
      );
      const alturaLinha = Math.max(...alturas);

      this.garantir(alturaLinha + 4);
      const topo = this.y;

      linha.forEach(([rotulo, valor], coluna) => {
        this.y = topo;
        const recuo = coluna * (largura + vao);
        this.texto(rotulo.toUpperCase(), {
          tamanho: 7.5,
          negrito: true,
          cor: CORES.fraco,
          recuo,
          largura,
          entrelinha: 1.5,
        });
        this.texto(String(valor), { tamanho: 9.5, cor: CORES.suave, recuo, largura });
      });

      this.y = topo - alturaLinha;
      this.espaco(4);
    }
  }

  /**
   * Link clicavel de verdade. O texto some se for maior que a largura, entao
   * a URL longa aparece encurtada — quem clica nao le, clica.
   */
  link(rotulo: string, url: string, recuo = 0) {
    const tamanho = 9.5;
    const largura = this.largura - recuo;
    let visivel = higienizar(rotulo);

    if (this.normal.widthOfTextAtSize(visivel, tamanho) > largura) {
      while (
        visivel.length > 8 &&
        this.normal.widthOfTextAtSize(`${visivel}...`, tamanho) > largura
      ) {
        visivel = visivel.slice(0, -1);
      }
      visivel = `${visivel}...`;
    }

    const altura = tamanho * 1.38;
    this.garantir(altura);
    this.y -= altura;

    const x = MARGEM + recuo;
    const base = this.y + altura - tamanho;
    const usada = this.normal.widthOfTextAtSize(visivel, tamanho);

    this.pagina.drawText(visivel, {
      x,
      y: base,
      size: tamanho,
      font: this.normal,
      color: CORES.marca,
    });
    this.pagina.drawLine({
      start: { x, y: base - 1.5 },
      end: { x: x + usada, y: base - 1.5 },
      thickness: 0.5,
      color: CORES.marca,
    });

    this.pagina.node.addAnnot(
      this.doc.context.register(
        this.doc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [x, base - 3, x + usada, base + tamanho],
          Border: [0, 0, 0],
          A: this.doc.context.obj({
            Type: "Action",
            S: "URI",
            URI: PDFString.of(urlDeLink(url)),
          }),
        }),
      ),
    );
  }

  /** Altura de uma linha de tabela: a da celula que mais quebra. */
  alturaLinha(celulas: Celula[]): number {
    return (
      Math.max(
        ...celulas.map((c) =>
          this.alturaDe(c.texto, {
            tamanho: c.tamanho,
            negrito: c.negrito,
            largura: c.largura - PREENCHIMENTO * 2 - (c.recuo ?? 0),
          }),
        ),
      ) +
      PREENCHIMENTO * 2
    );
  }

  /**
   * Uma linha de tabela, com as celulas lado a lado e o texto quebrando
   * dentro da propria coluna. Nao quebra de pagina no meio: a linha vai
   * inteira para a folha seguinte, senao a quantidade ficaria numa pagina e
   * a descricao na outra.
   */
  linhaTabela(celulas: Celula[], o: { fundo?: RGB } = {}) {
    const altura = this.alturaLinha(celulas);
    this.garantir(altura);
    const topo = this.y;

    if (o.fundo) {
      this.pagina.drawRectangle({
        x: MARGEM,
        y: topo - altura,
        width: this.largura,
        height: altura,
        color: o.fundo,
      });
    }

    let x = 0;
    for (const c of celulas) {
      const tamanho = c.tamanho ?? 9.5;
      const recuo = c.recuo ?? 0;
      const largura = c.largura - PREENCHIMENTO * 2 - recuo;

      if (c.alinhar === "direita") {
        /* Numero nao quebra; alinhado a direita, as unidades formam coluna. */
        const texto = higienizar(c.texto);
        const fonte = this.fonte(c.negrito);
        this.pagina.drawText(texto, {
          x: MARGEM + x + c.largura - PREENCHIMENTO - fonte.widthOfTextAtSize(texto, tamanho),
          y: topo - PREENCHIMENTO - tamanho,
          size: tamanho,
          font: fonte,
          color: c.cor ?? CORES.texto,
        });
      } else {
        this.y = topo - PREENCHIMENTO;
        this.texto(c.texto, {
          tamanho,
          negrito: c.negrito,
          cor: c.cor,
          recuo: x + PREENCHIMENTO + recuo,
          largura,
        });
      }
      x += c.largura;
    }

    this.y = topo - altura;
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y },
      end: { x: A4.largura - MARGEM, y: this.y },
      thickness: 0.5,
      color: CORES.borda,
    });
  }

  /** Bloco com fundo e faixa lateral, para o que nao pode passar batido. */
  caixa(rotulo: string, texto: string, tom: "destaque" | "neutro" = "neutro") {
    const recuo = 10;
    const largura = this.largura - recuo * 2;
    const alturaTexto =
      this.alturaDe(rotulo, { tamanho: 7.5, negrito: true, largura }) +
      this.alturaDe(texto, { tamanho: 9.5, largura });
    const alturaCaixa = alturaTexto + 14;

    this.garantir(alturaCaixa + 6);

    const fundo = tom === "destaque" ? CORES.destaque : CORES.fundoSuave;
    const faixa = tom === "destaque" ? CORES.destaqueBorda : CORES.bordaForte;
    /* O rotulo nunca usa a cor da faixa no tom neutro: cinza claro sobre
       fundo cinza claro so se le na tela, no papel some. */
    const corRotulo = tom === "destaque" ? CORES.destaqueBorda : CORES.fraco;

    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - alturaCaixa,
      width: this.largura,
      height: alturaCaixa,
      color: fundo,
    });
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - alturaCaixa,
      width: 2.5,
      height: alturaCaixa,
      color: faixa,
    });

    const topo = this.y;
    this.espaco(7);
    this.texto(rotulo.toUpperCase(), {
      tamanho: 7.5,
      negrito: true,
      cor: corRotulo,
      recuo,
      largura,
      entrelinha: 1.5,
    });
    this.texto(texto, { tamanho: 9.5, recuo, largura });
    this.y = topo - alturaCaixa;
    this.espaco(6);
  }

  /**
   * Numera as paginas so no fim, quando o total ja e conhecido — quem recebe
   * o PDF impresso precisa saber se veio folha faltando.
   */
  private numerarPaginas(legenda: string) {
    const paginas = this.doc.getPages();

    paginas.forEach((pagina, indice) => {
      pagina.drawLine({
        start: { x: MARGEM, y: RODAPE + 12 },
        end: { x: A4.largura - MARGEM, y: RODAPE + 12 },
        thickness: 0.7,
        color: CORES.borda,
      });
      pagina.drawText(higienizar(legenda), {
        x: MARGEM,
        y: RODAPE,
        size: 7.5,
        font: this.normal,
        color: CORES.fraco,
      });

      const numero = `Página ${indice + 1} de ${paginas.length}`;
      pagina.drawText(higienizar(numero), {
        x: A4.largura - MARGEM - this.normal.widthOfTextAtSize(numero, 7.5),
        y: RODAPE,
        size: 7.5,
        font: this.normal,
        color: CORES.fraco,
      });
    });
  }

  async bytes(legenda: string): Promise<Uint8Array> {
    this.numerarPaginas(legenda);
    return this.doc.save();
  }
}

/** Nome de arquivo sem acento nem espaco: o download vai por header HTTP. */
export function nomeArquivoPdf(base: string): string {
  return `${base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")}.pdf`;
}
