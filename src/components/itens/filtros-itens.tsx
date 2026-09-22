"use client";

import { Selecao } from "@/components/ui/campo";
import {
  AvisoFiltrando,
  BotaoLimpar,
  CampoBusca,
  useBuscaComEspera,
  useFiltrosUrl,
} from "@/components/ui/filtros";

const CHAVES = ["busca", "classificacao", "situacao", "cadastro", "local"];

export function FiltrosItens({
  classificacoes,
  locais,
}: {
  classificacoes: { id: string; nome: string }[];
  locais: { id: string; nome: string }[];
}) {
  const { params, aplicar, limpar, pendente } = useFiltrosUrl();
  const [busca, setBusca] = useBuscaComEspera(params, aplicar);

  const temFiltro = CHAVES.some((c) => params.get(c));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <CampoBusca
        valor={busca}
        aoMudar={setBusca}
        placeholder="Buscar por descrição, código ou localização"
        rotulo="Buscar itens"
      />

      <Selecao
        aria-label="Classificação"
        value={params.get("classificacao") ?? ""}
        onChange={(e) => aplicar({ classificacao: e.target.value })}
        className="w-auto min-w-40"
      >
        <option value="">Todas as classificações</option>
        {classificacoes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Selecao>


      <Selecao
        aria-label="Local"
        value={params.get("local") ?? ""}
        onChange={(e) => aplicar({ local: e.target.value })}
        className="w-auto min-w-40"
      >
        <option value="">Todos os locais</option>
        {locais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </Selecao>

      {/* Sem isto não havia como ver um item desativado: ele sumia da lista
          e ainda assim continuava segurando a classificação contra exclusão,
          o que fazia a tela parecer estar mentindo. */}
      <Selecao
        aria-label="Situação do cadastro"
        value={params.get("cadastro") ?? ""}
        onChange={(e) => aplicar({ cadastro: e.target.value })}
        className="w-auto min-w-36"
      >
        <option value="">Só ativos</option>
        <option value="todos">Ativos e inativos</option>
        <option value="inativos">Só inativos</option>
      </Selecao>

      <Selecao
        aria-label="Situação"
        value={params.get("situacao") ?? ""}
        onChange={(e) => aplicar({ situacao: e.target.value })}
        className="w-auto min-w-36"
      >
        <option value="">Todas as situações</option>
        <option value="ok">OK</option>
        <option value="falta">Em falta</option>
        <option value="abaixo_minimo">Abaixo do mínimo</option>
      </Selecao>

      {temFiltro && <BotaoLimpar aoLimpar={limpar} />}
      <AvisoFiltrando pendente={pendente} />
    </div>
  );
}
