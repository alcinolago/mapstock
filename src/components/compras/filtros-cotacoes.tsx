"use client";

import { Selecao } from "@/components/ui/campo";
import {
  AvisoFiltrando,
  BotaoLimpar,
  CampoBusca,
  useBuscaComEspera,
  useFiltrosUrl,
} from "@/components/ui/filtros";
import { opcoes, STATUS_COTACAO } from "@/lib/labels";
import { rotuloMes } from "@/lib/periodo";

const CHAVES = ["busca", "status", "item", "mes"];

/**
 * Os filtros da lista de cotacoes.
 *
 * O mes vinha sozinho no cabecalho e desceu para ca: filtro espalhado em dois
 * cantos da tela faz a pessoa procurar por que a lista esta curta.
 *
 * O filtro por item pergunta "em que cotacoes este codigo entrou?" — e a
 * pergunta que se faz quando falta peca e alguem quer saber se ja tem compra
 * andando para ela.
 */
export function FiltrosCotacoes({
  itens,
  meses,
}: {
  /** So os itens ja cotados: codigo que devolve lista vazia nao entra. */
  itens: { id: string; codigo: string; descricao: string }[];
  /** Do mais novo para o mais velho, so os que existem na base. */
  meses: string[];
}) {
  const { params, aplicar, limpar, pendente } = useFiltrosUrl();
  const [busca, setBusca] = useBuscaComEspera(params, aplicar);

  const temFiltro = CHAVES.some((c) => params.get(c));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <CampoBusca
        valor={busca}
        aoMudar={setBusca}
        placeholder="Buscar por número ou título"
        rotulo="Buscar cotações"
      />

      <Selecao
        aria-label="Status"
        value={params.get("status") ?? ""}
        onChange={(e) => aplicar({ status: e.target.value })}
        className="w-auto min-w-40"
      >
        <option value="">Todos os status</option>
        {opcoes(STATUS_COTACAO).map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </Selecao>

      <Selecao
        aria-label="Item cotado"
        value={params.get("item") ?? ""}
        onChange={(e) => aplicar({ item: e.target.value })}
        className="w-auto max-w-72 min-w-44"
      >
        <option value="">Todos os itens</option>
        {itens.map((i) => (
          <option key={i.id} value={i.id}>
            {i.codigo} — {i.descricao}
          </option>
        ))}
      </Selecao>

      <Selecao
        aria-label="Filtrar por mês"
        value={params.get("mes") ?? ""}
        onChange={(e) => aplicar({ mes: e.target.value })}
        className="w-auto min-w-40"
      >
        <option value="">Todo o período</option>
        {meses.map((m) => (
          <option key={m} value={m}>
            {rotuloMes(m)}
          </option>
        ))}
      </Selecao>

      {temFiltro && <BotaoLimpar aoLimpar={limpar} />}
      <AvisoFiltrando pendente={pendente} />
    </div>
  );
}
