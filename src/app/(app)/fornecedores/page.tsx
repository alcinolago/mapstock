import { desc, eq, sql } from "drizzle-orm";
import { ExternalLink, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";

import { Botao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao } from "@/components/ui/cartao";
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
import { fornecedores, itemFornecedores } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";
import { STATUS_FORNECEDOR, type StatusFornecedor } from "@/lib/labels";

export const metadata = { title: "Fornecedores" };

const TOM: Record<StatusFornecedor, TomSelo> = {
  preferencial: "ok",
  aprovado: "marca",
  em_avaliacao: "neutro",
  emergencia: "alerta",
  bloqueado: "perigo",
};

export default async function PaginaFornecedores() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const lista = await db
    .select({
      id: fornecedores.id,
      nome: fornecedores.nome,
      contato: fornecedores.contato,
      telefone: fornecedores.telefone,
      email: fornecedores.email,
      site: fornecedores.site,
      status: fornecedores.status,
      ativo: fornecedores.ativo,
      condicaoPagamento: fornecedores.condicaoPagamento,
      qtdItens: sql<number>`count(${itemFornecedores.id})::int`,
    })
    .from(fornecedores)
    .leftJoin(itemFornecedores, eq(itemFornecedores.fornecedorId, fornecedores.id))
    .groupBy(fornecedores.id)
    .orderBy(desc(fornecedores.ativo), fornecedores.nome);

  return (
    <div className="mx-auto max-w-7xl">
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

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Fornecedor</Coluna>
                <Coluna>Contato</Coluna>
                <Coluna>Pagamento</Coluna>
                <Coluna className="text-right">Itens</Coluna>
                <Coluna>Status</Coluna>
                <Coluna />
              </tr>
            </Cabecalho>
            <Corpo>
              {lista.length === 0 ? (
                <Vazio colSpan={6}>
                  Nenhum fornecedor cadastrado. Comece por aqui — os itens se ligam a esta lista.
                </Vazio>
              ) : (
                lista.map((f) => (
                  <Linha key={f.id}>
                    <Celula>
                      <Link
                        href={`/fornecedores/${f.id}`}
                        className="font-semibold text-marca hover:underline"
                      >
                        {f.nome}
                      </Link>
                      {!f.ativo && (
                        <span className="ml-2 text-xs text-texto-fraco">inativo</span>
                      )}
                      {f.email && (
                        <span className="block text-xs text-texto-fraco">{f.email}</span>
                      )}
                    </Celula>
                    <Celula className="text-xs text-texto-suave">
                      {f.contato && <span className="block">{f.contato}</span>}
                      {f.telefone && <span className="block">{f.telefone}</span>}
                      {!f.contato && !f.telefone && "—"}
                    </Celula>
                    <Celula className="text-xs text-texto-fraco">
                      {f.condicaoPagamento ?? "—"}
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
                            className="rounded-md p-1.5 text-texto-fraco transition-colors hover:bg-ok-suave hover:text-ok"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                        {f.site && (
                          <a
                            href={f.site}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir site"
                            className="rounded-md p-1.5 text-texto-fraco transition-colors hover:bg-marca-suave hover:text-marca"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>
                    </Celula>
                  </Linha>
                ))
              )}
            </Corpo>
          </Tabela>
        </RolagemTabela>
      </Cartao>
    </div>
  );
}
