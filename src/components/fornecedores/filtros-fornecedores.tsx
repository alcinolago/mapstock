"use client";

import { Selecao } from "@/components/ui/campo";
import {
  AvisoFiltrando,
  BotaoLimpar,
  CampoBusca,
  useBuscaComEspera,
  useFiltrosUrl,
} from "@/components/ui/filtros";
import { opcoes, STATUS_FORNECEDOR } from "@/lib/labels";

const CHAVES = ["busca", "status", "situacao"];

/**
 * Os filtros da lista de fornecedores.
 *
 * "Situacao" comeca em todos, e nao em ativos: a lista sempre mostrou o
 * inativo no fim, e esconde-lo por padrao faria sumir cadastro que ainda
 * aparece em pedido antigo. Quem quer o recorte pede.
 */
export function FiltrosFornecedores() {
  const { params, aplicar, limpar, pendente } = useFiltrosUrl();
  const [busca, setBusca] = useBuscaComEspera(params, aplicar);

  const temFiltro = CHAVES.some((c) => params.get(c));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <CampoBusca
        valor={busca}
        aoMudar={setBusca}
        placeholder="Buscar por nome, contato, e-mail ou telefone"
        rotulo="Buscar fornecedores"
      />

      <Selecao
        aria-label="Status"
        value={params.get("status") ?? ""}
        onChange={(e) => aplicar({ status: e.target.value })}
        className="w-auto min-w-40"
      >
        <option value="">Todos os status</option>
        {opcoes(STATUS_FORNECEDOR).map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </Selecao>

      <Selecao
        aria-label="Situação do cadastro"
        value={params.get("situacao") ?? ""}
        onChange={(e) => aplicar({ situacao: e.target.value })}
        className="w-auto min-w-36"
      >
        <option value="">Ativos e inativos</option>
        <option value="ativos">Só ativos</option>
        <option value="inativos">Só inativos</option>
      </Selecao>

      {temFiltro && <BotaoLimpar aoLimpar={limpar} />}
      <AvisoFiltrando pendente={pendente} />
    </div>
  );
}
