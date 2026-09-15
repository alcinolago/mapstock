/**
 * Geração de CSV para abrir no Excel em português.
 *
 * Três detalhes que decidem se o arquivo abre certo ou vira uma coluna só
 * de caractere estranho — os mesmos que o export do sistema desktop já
 * acertava (export_csv, linha 1431 do MPZ-ERP-V35.pyw):
 *
 * 1. Separador ponto e vírgula. O Excel em português usa a vírgula como
 *    separador decimal, então espera ponto e vírgula entre as colunas.
 * 2. BOM no começo do arquivo. Sem ele o Excel lê como Latin-1 e "Fixação"
 *    aparece como "FixaÃ§Ã£o".
 * 3. Número com vírgula decimal, senão 0.92 é lido como data ou como texto.
 */

/* Escrito como escape: o caractere literal é invisível no editor e
   se perde em qualquer edição descuidada — e sem ele o Excel em
   português lê o arquivo como Latin-1. */
const BOM = "\uFEFF";

export type CelulaCsv = string | number | boolean | Date | null | undefined;

function formatar(valor: CelulaCsv): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? String(valor).replace(".", ",") : "";
  }
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (valor instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(valor);
  }
  return valor;
}

/** Aspas em volta só quando o conteúdo tem separador, aspas ou quebra de linha. */
function escapar(texto: string): string {
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function paraCsv(colunas: string[], linhas: CelulaCsv[][]): string {
  const corpo = [colunas, ...linhas]
    .map((linha) => linha.map((c) => escapar(formatar(c))).join(";"))
    .join("\r\n");
  return BOM + corpo + "\r\n";
}

/** Nome de arquivo com a data, para não sobrescrever o download anterior. */
export function nomeArquivo(base: string): string {
  const agora = new Date();
  const d = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, "0"),
    String(agora.getDate()).padStart(2, "0"),
  ].join("-");
  const h = [
    String(agora.getHours()).padStart(2, "0"),
    String(agora.getMinutes()).padStart(2, "0"),
  ].join("");
  return `${base}_${d}_${h}.csv`;
}

export function respostaCsv(conteudo: string, base: string): Response {
  return new Response(conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo(base)}"`,
      "Cache-Control": "no-store",
    },
  });
}
