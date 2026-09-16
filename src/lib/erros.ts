/**
 * Leitura de erro do banco.
 *
 * O drizzle embrulha o erro do Postgres: a mensagem de fora vira
 * "Failed query: insert into ..." e o texto que interessa ("duplicate key
 * value violates unique constraint") fica escondido em `cause`. Quem
 * procurava a palavra na mensagem de fora nunca achava, e a pessoa levava um
 * "não foi possível salvar" no lugar de "já existe um item com esse código".
 *
 * Por isso a checagem desce a corrente de causas em vez de olhar só o topo.
 */
function mensagens(erro: unknown, profundidade = 0): string {
  if (!erro || profundidade > 4) return "";
  if (typeof erro === "string") return erro;
  if (typeof erro !== "object") return "";

  const e = erro as { message?: unknown; cause?: unknown };
  const propria = typeof e.message === "string" ? e.message : "";
  return `${propria}\n${mensagens(e.cause, profundidade + 1)}`;
}

/** Violação de unicidade — código 23505 do Postgres. */
export function ehDuplicado(erro: unknown): boolean {
  return /duplicate key|already exists|23505/i.test(mensagens(erro));
}
