/**
 * Compactacao da foto antes de sair do navegador.
 *
 * A decisao de guardar as fotos no proprio Postgres so se sustenta se o que
 * chega la for pequeno: a foto que o celular tira tem 3 a 6 MB, e esta funcao
 * a devolve com cerca de 200 KB — mesma peca, mesma leitura na tela, um vinte
 * avos do peso. Sem isso, tres fotos por item encheriam a cota do banco em
 * poucas centenas de itens, e cada abertura da lista puxaria megabytes.
 *
 * Roda no cliente de proposito. Compactar no servidor exigiria receber os 6 MB
 * primeiro — e o corpo de uma server action nao passa de 1 MB.
 *
 * JPEG, e nao WebP, porque a mesma foto precisa entrar no PDF do pedido e o
 * pdf-lib so embute JPEG e PNG. WebP pouparia mais uns 30%, mas custaria uma
 * segunda copia so para o PDF.
 */

export const MAX_FOTOS = 3;
export const TIPO_FOTO = "image/jpeg";

/** Teto do que a action aceita, com folga sobre o que esta funcao produz. */
export const MAX_BYTES_FOTO = 700 * 1024;

/* 1400px atende tanto o zoom na tela cheia quanto a impressao no PDF. Acima
   disso so cresce o arquivo. */
const LADOS = [1400, 1000];
const QUALIDADES = [0.82, 0.72, 0.62, 0.5];
const ALVO = 220 * 1024;

/* A miniatura e outra imagem, nao a mesma reduzida por CSS: a lista de itens
   mostra 20 linhas de uma vez, e 20 fotos de 220 KB seriam 4 MB de trafego
   para caber em quadrados de 32px.

   260px e nao 200: e esta copia que tambem vai para o PDF do pedido, onde
   ocupa uns 90pt de largura — o que da cerca de 200 DPI na impressao. Com a
   foto inteira no lugar dela, um pedido de 15 linhas viraria um anexo de
   3 MB para mandar por e-mail. */
const LADO_MINIATURA = 260;
const QUALIDADE_MINIATURA = 0.72;

export function ehImagem(arquivo: File) {
  return arquivo.type.startsWith("image/");
}

export type FotoCompactada = {
  /** O que se guarda e o que abre no zoom e no PDF. */
  foto: File;
  /** O que a lista e o seletor carregam. */
  miniatura: File;
};

/**
 * Reduz e recomprime, e devolve tambem a miniatura.
 *
 * Desce a qualidade — e depois a dimensao — ate caber no alvo; se nem assim
 * couber, entrega a menor versao que conseguiu.
 */
export async function compactarFoto(arquivo: File): Promise<FotoCompactada> {
  const fonte = await carregar(arquivo);

  try {
    const miniatura = comoArquivo(
      await paraBlob(desenhar(fonte, LADO_MINIATURA), QUALIDADE_MINIATURA),
      arquivo.name,
    );

    let menor: Blob | null = null;

    for (const lado of LADOS) {
      const tela = desenhar(fonte, lado);

      for (const qualidade of QUALIDADES) {
        const blob = await paraBlob(tela, qualidade);
        if (!menor || blob.size < menor.size) menor = blob;
        if (blob.size <= ALVO) return { foto: comoArquivo(blob, arquivo.name), miniatura };
      }
    }

    if (!menor) throw new Error("Não foi possível processar esta imagem.");
    return { foto: comoArquivo(menor, arquivo.name), miniatura };
  } finally {
    if (fonte instanceof ImageBitmap) fonte.close();
  }
}

/* ------------------------------------------------------------------------ */

type Fonte = ImageBitmap | HTMLImageElement;

/* `imageOrientation` aplica o EXIF da camera: sem isso a foto tirada em pe
   chega deitada, porque o giro mora no metadado e nao nos pixels. Nem todo
   navegador aceita a opcao — o <img> resolve sozinho, e serve de reserva. */
async function carregar(arquivo: File): Promise<Fonte> {
  try {
    return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    return carregarPorTag(arquivo);
  }
}

function carregarPorTag(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Arquivo de imagem inválido."));
    };
    img.src = url;
  });
}

function desenhar(fonte: Fonte, lado: number) {
  const largura = fonte instanceof ImageBitmap ? fonte.width : fonte.naturalWidth;
  const altura = fonte instanceof ImageBitmap ? fonte.height : fonte.naturalHeight;

  /* Nunca amplia: foto pequena fica do tamanho que e. */
  const escala = Math.min(1, lado / Math.max(largura, altura));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(largura * escala));
  tela.height = Math.max(1, Math.round(altura * escala));

  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar esta imagem.");

  /* Fundo branco: JPEG nao tem transparencia, e um PNG com fundo vazado
     viraria preto no lugar do transparente. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.drawImage(fonte, 0, 0, tela.width, tela.height);
  return tela;
}

function paraBlob(tela: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    tela.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao compactar a imagem."))),
      TIPO_FOTO,
      qualidade,
    );
  });
}

function comoArquivo(blob: Blob, nomeOriginal: string) {
  const base = nomeOriginal.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: TIPO_FOTO });
}
