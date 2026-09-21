"use client";

import { Selecao } from "@/components/ui/campo";
import {
  AvisoFiltrando,
  BotaoLimpar,
  CampoBusca,
  useBuscaComEspera,
  useFiltrosUrl,
} from "@/components/ui/filtros";

const CHAVES = ["busca", "classificacao", "situacao", "item", "local"];

export function FiltrosItens({
  classificacoes,
  itens,
  locais,
}: {
  classificacoes: { id: string; nome: string }[];
  /** Todo o cadastro, para escolher pelo codigo sem digitar. */
  itens: { id: string; codigo: string; ativo: boolean }[];
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
        placeholder="Buscar por código, descrição ou localização"
        rotulo="Buscar itens"
      />

      <Selecao
        aria-label="Código do item"
        value={params.get("item") ?? ""}
        onChange={(e) => aplicar({ item: e.target.value })}
        className="codigo w-auto min-w-36"
      >
        <option value="">Todos os códigos</option>
        {itens.map((i) => (
          <option key={i.id} value={i.id}>
            {i.codigo}
            {i.ativo ? "" : " (inativo)"}
          </option>
        ))}
      </Selecao>

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
