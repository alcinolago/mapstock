import { desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";

import { FormularioMovimento } from "@/components/estoque/formulario-movimento";
import { Historico } from "@/components/estoque/historico";
import { Botao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import { listarItensComSaldo, primeiroMovimento, recorteDoMes } from "@/db/consultas";
import { itens, movimentos, unidades, usuarios } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { mesesAte, mesValido } from "@/lib/periodo";

export const metadata = { title: "Estoque" };

export default async function PaginaEstoque({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const p = await searchParams;
  /* O recorte vai para a consulta, nao para o cliente: o historico chega
     limitado, e filtrar mes depois mostraria so o que coubesse no limite —
     um mes antigo viria vazio mesmo tendo lancamento. */
  const mes = mesValido(p.mes);

  const [comSaldo, historico, maisAntigo] = await Promise.all([
    listarItensComSaldo(),
    db
      .select({
        id: movimentos.id,
        itemId: movimentos.itemId,
        codigo: itens.codigo,
        descricao: itens.descricao,
        unidade: unidades.sigla,
        tipo: movimentos.tipo,
        quantidade: movimentos.quantidade,
        referencia: movimentos.referencia,
        observacao: movimentos.observacao,
        usuario: usuarios.nome,
        criadoEm: movimentos.criadoEm,
      })
      .from(movimentos)
      .innerJoin(itens, eq(itens.id, movimentos.itemId))
      .innerJoin(unidades, eq(unidades.id, itens.unidadeId))
      .leftJoin(usuarios, eq(usuarios.id, movimentos.usuarioId))
      .where(recorteDoMes(movimentos.criadoEm, mes))
      .orderBy(desc(movimentos.criadoEm))
      .limit(300),
    primeiroMovimento(),
  ]);

  /* Nivel 0 e o equipamento montado — nao se movimenta em estoque. */
  const selecionaveis = comSaldo
    .filter((i) => i.nivel > 0)
    .map((i) => ({
      id: i.id,
      codigo: i.codigo,
      descricao: i.descricao,
      unidade: i.unidade,
      disponivel: i.disponivel,
    }));

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Estoque"
        descricao="Entradas, saídas, reservas e ajustes. O saldo é sempre a soma do histórico."
        acao={
          /* Leva o recorte junto: baixa o que esta sendo visto. */
          <a href={`/api/exportar/movimentos${mes ? `?mes=${mes}` : ""}`}>
            <Botao variante="contorno">
              <Download className="size-4" />
              Exportar CSV
            </Botao>
          </a>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        {podeEditar ? (
          <FormularioMovimento itens={selecionaveis} />
        ) : (
          <p className="rounded-xl border border-borda bg-superficie px-4 py-6 text-sm text-texto-fraco">
            Seu perfil é somente leitura: dá para consultar o histórico, mas não lançar
            movimentações.
          </p>
        )}

        <Historico
          movimentos={historico}
          podeEditar={podeEditar}
          meses={mesesAte(maisAntigo)}
        />
      </div>
    </div>
  );
}
