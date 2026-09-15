import {
  ArrowRight,
  Boxes,
  CircleAlert,
  PackageX,
  ShoppingCart,
  TrendingDown,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SeloMovimento, SeloSituacao } from "@/components/situacao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
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
import { resumoPainel, ultimosMovimentos } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";
import { dataHora, moeda, numero } from "@/lib/utils";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const sessao = await exigirSessao();
  const [resumo, movimentos] = await Promise.all([resumoPainel(), ultimosMovimentos()]);

  const primeiroNome = sessao.nome.split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo={`Olá, ${primeiroNome}`}
        descricao="Situação do estoque e das compras agora."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Itens cadastrados"
          valor={numero(resumo.totalItens)}
          Icone={Boxes}
          href="/itens"
        />
        <Indicador
          rotulo="Em falta"
          valor={numero(resumo.emFalta)}
          Icone={PackageX}
          tom={resumo.emFalta > 0 ? "perigo" : "ok"}
          href="/itens?situacao=falta"
        />
        <Indicador
          rotulo="Abaixo do mínimo"
          valor={numero(resumo.abaixoMinimo)}
          Icone={TrendingDown}
          tom={resumo.abaixoMinimo > 0 ? "alerta" : "ok"}
          href="/itens?situacao=abaixo_minimo"
        />
        <Indicador
          rotulo="Valor em estoque"
          valor={moeda(resumo.valorEstoque)}
          Icone={Wallet}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Indicador
          rotulo="Cotações em andamento"
          valor={numero(resumo.cotacoesAbertas)}
          Icone={CircleAlert}
          href="/compras/cotacoes"
        />
        <Indicador
          rotulo="Pedidos a receber"
          valor={numero(resumo.pedidosAbertos)}
          Icone={ShoppingCart}
          href="/compras/pedidos"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao
            titulo="Precisa de atenção"
            descricao="Em falta ou abaixo do estoque mínimo"
            acao={
              <Link
                href="/compras/cotacoes/nova"
                className="inline-flex items-center gap-1 text-xs font-semibold text-marca hover:underline"
              >
                Cotar itens <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <RolagemTabela>
            <Tabela>
              <Cabecalho>
                <tr>
                  <Coluna>Item</Coluna>
                  <Coluna className="text-right">Disponível</Coluna>
                  <Coluna className="text-right">Mínimo</Coluna>
                  <Coluna>Situação</Coluna>
                </tr>
              </Cabecalho>
              <Corpo>
                {resumo.atencao.length === 0 ? (
                  <Vazio colSpan={4}>Nada em falta. Estoque em dia.</Vazio>
                ) : (
                  resumo.atencao.map((i) => (
                    <Linha key={i.id}>
                      <Celula>
                        <Link href={`/itens/${i.id}`} className="group block min-w-0">
                          <span className="codigo block text-xs font-semibold text-marca group-hover:underline">
                            {i.codigo}
                          </span>
                          <span className="block truncate text-xs text-texto-fraco">
                            {i.descricao}
                          </span>
                        </Link>
                      </Celula>
                      <Celula className="num text-right font-semibold">
                        {numero(i.disponivel)} {i.unidade}
                      </Celula>
                      <Celula className="num text-right text-texto-fraco">
                        {numero(i.estoqueMinimo)}
                      </Celula>
                      <Celula>
                        <SeloSituacao situacao={i.situacao} />
                      </Celula>
                    </Linha>
                  ))
                )}
              </Corpo>
            </Tabela>
          </RolagemTabela>
        </Cartao>

        <Cartao>
          <CabecalhoCartao
            titulo="Últimas movimentações"
            acao={
              <Link
                href="/estoque"
                className="inline-flex items-center gap-1 text-xs font-semibold text-marca hover:underline"
              >
                Ver tudo <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <RolagemTabela>
            <Tabela>
              <Cabecalho>
                <tr>
                  <Coluna>Quando</Coluna>
                  <Coluna>Tipo</Coluna>
                  <Coluna>Item</Coluna>
                  <Coluna className="text-right">Qtd.</Coluna>
                </tr>
              </Cabecalho>
              <Corpo>
                {movimentos.length === 0 ? (
                  <Vazio colSpan={4}>Nenhuma movimentação lançada ainda.</Vazio>
                ) : (
                  movimentos.map((m) => (
                    <Linha key={m.id}>
                      <Celula className="text-xs whitespace-nowrap text-texto-fraco">
                        {dataHora(m.criadoEm)}
                        {m.usuario && <span className="block">{m.usuario}</span>}
                      </Celula>
                      <Celula>
                        <SeloMovimento tipo={m.tipo} />
                      </Celula>
                      <Celula>
                        <span className="codigo block text-xs font-semibold">{m.codigo}</span>
                        <span className="block max-w-44 truncate text-xs text-texto-fraco">
                          {m.descricao}
                        </span>
                      </Celula>
                      <Celula className="num text-right font-semibold whitespace-nowrap">
                        {numero(m.quantidade)} {m.unidade}
                      </Celula>
                    </Linha>
                  ))
                )}
              </Corpo>
            </Tabela>
          </RolagemTabela>
        </Cartao>
      </div>
    </div>
  );
}

const TONS = {
  marca: "bg-marca-suave text-marca",
  ok: "bg-ok-suave text-ok",
  alerta: "bg-alerta-suave text-alerta",
  perigo: "bg-perigo-suave text-perigo",
} as const;

function Indicador({
  rotulo,
  valor,
  Icone,
  tom = "marca",
  href,
}: {
  rotulo: string;
  valor: string;
  Icone: React.ComponentType<{ className?: string }>;
  tom?: keyof typeof TONS;
  href?: string;
}) {
  const conteudo: ReactNode = (
    <>
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${TONS[tom]}`}>
        <Icone className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-texto-fraco">{rotulo}</span>
        <span className="num mt-0.5 block truncate text-xl font-bold tracking-tight text-texto">
          {valor}
        </span>
      </span>
    </>
  );

  const classe =
    "flex items-center gap-3 rounded-xl border border-borda bg-superficie p-4 shadow-[var(--sombra)] transition-colors";

  return href ? (
    <Link href={href} className={`${classe} hover:border-marca/40`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}
