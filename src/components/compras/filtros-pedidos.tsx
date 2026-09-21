"use client";

import { Selecao } from "@/components/ui/campo";
import {
  AvisoFiltrando,
  BotaoLimpar,
  CampoBusca,
  useBuscaComEspera,
  useFiltrosUrl,
} from "@/components/ui/filtros";
import { opcoes, STATUS_PEDIDO } from "@/lib/labels";
import { rotuloMes } from "@/lib/periodo";

const CHAVES = ["busca", "status", "fornecedor", "item", "mes"];

/**
 * Os filtros da lista de pedidos.
 *
 * Fornecedor e item sao os dois caminhos de quem esta atras de uma compra:
 * "o que pedi para a Multcomercial" e "quando foi que este parafuso entrou".
 * As duas listas saem do que ja tem pedido — oferecer o cadastro inteiro
 * daria escolha que devolve tela vazia.
 */
export function FiltrosPedidos({
  fornecedores,
  itens,
  meses,
}: {
  fornecedores: { id: string; nome: string }[];
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
        placeholder="Buscar por número do pedido"
        rotulo="Buscar pedidos"
      />

      <Selecao
        aria-label="Status"
        value={params.get("status") ?? ""}
        onChange={(e) => aplicar({ status: e.target.value })}
        className="w-auto min-w-40"
      >
        <option value="">Todos os status</option>
        {opcoes(STATUS_PEDIDO).map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </Selecao>

      <Selecao
        aria-label="Fornecedor"
        value={params.get("fornecedor") ?? ""}
        onChange={(e) => aplicar({ fornecedor: e.target.value })}
        className="w-auto max-w-64 min-w-44"
      >
        <option value="">Todos os fornecedores</option>
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </Selecao>

      <Selecao
        aria-label="Item pedido"
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
