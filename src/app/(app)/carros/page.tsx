import { Plus } from "lucide-react";
import Link from "next/link";

import { AbasFrota } from "@/components/frota/abas-frota";
import { Botao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
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
import { listarCarros } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Carros" };

export default async function PaginaCarros() {
  const sessao = await exigirSessao();
  const carros = await listarCarros();

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Carros"
        descricao="A frota, o equipamento montado em cada carro e as versões que rodam nele."
        acao={
          sessao.papel !== "leitura" && (
            <Link href="/carros/novo">
              <Botao>
                <Plus />
                Novo carro
              </Botao>
            </Link>
          )
        }
      />

      <AbasFrota />

      <Cartao className="overflow-hidden">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Placa</Coluna>
                <Coluna>Veículo</Coluna>
                <Coluna>PC</Coluna>
                <Coluna>Equipamento</Coluna>
                <Coluna>Sistema</Coluna>
                <Coluna>Tablet</Coluna>
              </tr>
            </Cabecalho>
            <Corpo>
              {carros.length === 0 ? (
                <Vazio colSpan={6}>
                  Nenhum carro cadastrado ainda. O equipamento montado é instalado num carro pela
                  placa.
                </Vazio>
              ) : (
                carros.map((c) => (
                  <Linha key={c.id}>
                    <Celula>
                      <Link
                        href={`/carros/${c.id}`}
                        className="codigo text-xs font-semibold text-marca hover:underline"
                      >
                        {c.placa}
                      </Link>
                    </Celula>
                    <Celula className="font-medium whitespace-nowrap">
                      {c.fabricante} {c.modelo}
                    </Celula>
                    <Celula className="text-xs text-texto-fraco">{c.pc ?? "—"}</Celula>
                    <Celula className="text-xs">
                      {c.montagemId ? (
                        <Link
                          href={`/itens/${c.equipamentoId}`}
                          className="font-semibold text-marca hover:underline"
                        >
                          {c.equipamentoCodigo}
                        </Link>
                      ) : (
                        <span className="text-texto-fraco">sem equipamento</span>
                      )}
                      {c.montagemNumero && (
                        <span className="ml-1.5 text-texto-fraco">{c.montagemNumero}</span>
                      )}
                    </Celula>
                    <Celula>
                      {c.versaoSistema ? (
                        <Selo tom="neutro">{c.versaoSistema}</Selo>
                      ) : (
                        <span className="text-xs text-texto-fraco">—</span>
                      )}
                    </Celula>
                    <Celula>
                      {c.versaoTablet ? (
                        <Selo tom="neutro">{c.versaoTablet}</Selo>
                      ) : (
                        <span className="text-xs text-texto-fraco">—</span>
                      )}
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
