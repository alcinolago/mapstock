import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { ExternalLink, MapPin, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";

import { FiltrosFornecedores } from "@/components/fornecedores/filtros-fornecedores";
import { Botao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao } from "@/components/ui/cartao";
import { Copiavel } from "@/components/ui/copiavel";
import { Paginacao } from "@/components/ui/paginacao";
import { Selo, type TomSelo } from "@/components/ui/selo";
import {
  Cabecalho,
  Celula,
  Coluna,
  Corpo,
  Linha,
  RolagemTabela,
  Tabela,
  Vazio,
} from "@/components/ui/tabela";
import { db } from "@/db";
import { fornecedores, itemFornecedores, statusFornecedor } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { STATUS_FORNECEDOR, type StatusFornecedor } from "@/lib/labels";
import { linkRota } from "@/lib/mapa";
import { lerPaginacao, paginaValida } from "@/lib/paginacao";

export const metadata = { title: "Fornecedores" };

const TOM: Record<StatusFornecedor, TomSelo> = {
  preferencial: "ok",
  aprovado: "marca",
  em_avaliacao: "neutro",
  emergencia: "alerta",
  bloqueado: "perigo",
};

export default async function PaginaFornecedores({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const p = await searchParams;
  const busca = p.busca?.trim() || undefined;
  const situacao = p.situacao === "ativos" || p.situacao === "inativos" ? p.situacao : undefined;
  const status = (statusFornecedor.enumValues as readonly string[]).includes(p.status ?? "")
    ? (p.status as StatusFornecedor)
    : undefined;

  /* Os filtros correm na consulta, nunca no cliente: a lista chega paginada,
     e peneirar depois so olharia a pagina que ja veio. */
  const condicoes = [
    busca
      ? or(
          ilike(fornecedores.nome, `%${busca}%`),
          ilike(fornecedores.contato, `%${busca}%`),
          ilike(fornecedores.email, `%${busca}%`),
          ilike(fornecedores.telefone, `%${busca}%`),
        )
      : undefined,
    status ? eq(fornecedores.status, status) : undefined,
    situacao ? eq(fornecedores.ativo, situacao === "ativos") : undefined,
  ].filter(Boolean) as SQL[];

  const onde = condicoes.length ? and(...condicoes) : undefined;

  /* A contagem vem antes para prender a pagina ao que existe: filtrar
     encolhe a lista com a pessoa parada numa pagina alta. */
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(fornecedores)
    .where(onde);

  const pedida = lerPaginacao(p.pagina, p.porPagina);
  const pagina = paginaValida(pedida.pagina, total, pedida.porPagina);

  const lista = await db
    .select({
      id: fornecedores.id,
      nome: fornecedores.nome,
      contato: fornecedores.contato,
      telefone: fornecedores.telefone,
      email: fornecedores.email,
      site: fornecedores.site,
      endereco: fornecedores.endereco,
      status: fornecedores.status,
      ativo: fornecedores.ativo,
      qtdItens: sql<number>`count(${itemFornecedores.id})::int`,
    })
    .from(fornecedores)
    .leftJoin(itemFornecedores, eq(itemFornecedores.fornecedorId, fornecedores.id))
    .where(onde)
    .groupBy(fornecedores.id)
    .orderBy(desc(fornecedores.ativo), fornecedores.nome)
    .limit(pedida.porPagina)
    .offset((pagina - 1) * pedida.porPagina);

  return (
    <>
      <CabecalhoPagina
        titulo="Fornecedores"
        descricao="Cadastro único — cada fornecedor pode atender vários itens."
        acao={
          podeEditar && (
            <Link href="/fornecedores/novo">
              <Botao>
                <Plus className="size-4" />
                Novo fornecedor
              </Botao>
            </Link>
          )
        }
      />

      <FiltrosFornecedores />

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Fornecedor</Coluna>
                <Coluna>Contato</Coluna>
                <Coluna>E-mail</Coluna>
                <Coluna>Telefone</Coluna>
                <Coluna className="text-right">Itens</Coluna>
                <Coluna>Status</Coluna>
                <Coluna />
              </tr>
            </Cabecalho>
            <Corpo>
              {lista.length === 0 ? (
                <Vazio colSpan={7}>
                  {busca || status || situacao
                    ? "Nenhum fornecedor com esses filtros."
                    : "Nenhum fornecedor cadastrado. Comece por aqui — os itens se ligam a esta lista."}
                </Vazio>
              ) : (
                lista.map((f) => {
                  const rota = linkRota(f.endereco);
                  return (
                    <Linha key={f.id}>
                      <Celula>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/fornecedores/${f.id}`}
                            className="font-semibold text-marca hover:underline"
                          >
                            {f.nome}
                          </Link>
                          {/* Mesmo chip do Status, do lado dele: desativado é
                              informação de situação, não uma observação solta. */}
                          {!f.ativo && <Selo tom="neutro">inativo</Selo>}
                        </div>
                      </Celula>
                      <Celula className="text-xs text-texto-suave">{f.contato || "—"}</Celula>
                      <Celula className="max-w-56 text-xs text-texto-suave">
                        {f.email ? <Copiavel valor={f.email} rotulo="e-mail" /> : "—"}
                      </Celula>
                      <Celula className="text-xs text-texto-suave">
                        {f.telefone ? <Copiavel valor={f.telefone} rotulo="telefone" /> : "—"}
                      </Celula>
                      <Celula className="num text-right font-semibold">{f.qtdItens}</Celula>
                      <Celula>
                        <Selo tom={TOM[f.status]}>{STATUS_FORNECEDOR[f.status]}</Selo>
                      </Celula>
                      <Celula>
                        <div className="flex items-center justify-end gap-1">
                          {f.telefone && (
                            <a
                              href={`https://wa.me/${
                                f.telefone.replace(/\D/g, "").startsWith("55")
                                  ? f.telefone.replace(/\D/g, "")
                                  : `55${f.telefone.replace(/\D/g, "")}`
                              }`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap text-texto-suave transition-colors hover:bg-ok-suave hover:text-ok"
                            >
                              <MessageCircle className="size-4" />
                              WhatsApp
                            </a>
                          )}
                          {rota && (
                            <a
                              href={rota}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Como chegar"
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap text-texto-suave transition-colors hover:bg-marca-suave hover:text-marca"
                            >
                              <MapPin className="size-4" />
                              Como chegar
                            </a>
                          )}
                          {f.site && (
                            <a
                              href={f.site}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir site"
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap text-texto-suave transition-colors hover:bg-marca-suave hover:text-marca"
                            >
                              <ExternalLink className="size-4" />
                              Site
                            </a>
                          )}
                        </div>
                      </Celula>
                    </Linha>
                  );
                })
              )}
            </Corpo>
          </Tabela>
        </RolagemTabela>

        <Paginacao
          pagina={pagina}
          porPagina={pedida.porPagina}
          total={total}
          oQue="fornecedores"
        />
      </Cartao>
    </>
  );
}
