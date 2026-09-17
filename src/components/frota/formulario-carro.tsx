"use client";

import { AlertCircle, Car, LoaderCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Botao } from "@/components/ui/botao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import { excluirCarro, salvarCarro, type EstadoCarro } from "@/lib/acoes/frota";
import { data } from "@/lib/utils";

export type DadosCarro = {
  id: string;
  placa: string;
  fabricante: string;
  modelo: string;
  pc: string | null;
  versaoSistemaId: string | null;
  versaoTabletId: string | null;
  montagemId: string | null;
};

export type OpcaoVersao = { id: string; tipo: string; numero: string };

export type OpcaoMontagem = {
  id: string;
  numero: string;
  codigo: string;
  descricao: string;
  montadaEm: Date;
};

export function FormularioCarro({
  carro,
  versoes,
  montagens,
  podeExcluir,
}: {
  carro?: DadosCarro;
  versoes: OpcaoVersao[];
  montagens: OpcaoMontagem[];
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [estado, acao, salvando] = useActionState<EstadoCarro, FormData>(salvarCarro, {});

  useEffect(() => {
    if (estado.ok) router.push("/carros");
  }, [estado.ok, router]);

  const erroNoCampo = (campo: string) => (estado.campo === campo ? estado.erro : undefined);
  const doTipo = (tipo: string) => versoes.filter((v) => v.tipo === tipo);

  async function aoExcluir() {
    if (!carro) return;
    const r = await excluirCarro(carro.id);
    if (r.erro) return r;
    router.push("/carros");
  }

  return (
    <form action={acao} className="space-y-5">
      {carro && <input type="hidden" name="id" value={carro.id} />}

      <Cartao>
        <CabecalhoCartao titulo="Dados do carro" />
        <CorpoCartao className="grid gap-4 sm:grid-cols-2">
          <Grupo
            rotulo="Placa"
            obrigatorio
            htmlFor="placa"
            erro={erroNoCampo("placa")}
            ajuda="Formato antigo (ABC1234) ou Mercosul (ABC1D23)."
          >
            <Entrada
              id="placa"
              name="placa"
              defaultValue={carro?.placa ?? ""}
              placeholder="ABC1D23"
              className="codigo uppercase"
              required
              autoFocus
            />
          </Grupo>

          <Grupo
            rotulo="Identificação do PC"
            htmlFor="pc"
            ajuda="Nome da máquina, patrimônio ou número de série do computador de bordo."
          >
            <Entrada id="pc" name="pc" defaultValue={carro?.pc ?? ""} placeholder="Ex.: MPZ-PC-014" />
          </Grupo>

          <Grupo rotulo="Fabricante" obrigatorio htmlFor="fabricante" erro={erroNoCampo("fabricante")}>
            <Entrada
              id="fabricante"
              name="fabricante"
              defaultValue={carro?.fabricante ?? ""}
              placeholder="Ex.: Fiat"
              required
            />
          </Grupo>

          <Grupo rotulo="Modelo" obrigatorio htmlFor="modelo" erro={erroNoCampo("modelo")}>
            <Entrada
              id="modelo"
              name="modelo"
              defaultValue={carro?.modelo ?? ""}
              placeholder="Ex.: Fiorino"
              required
            />
          </Grupo>
        </CorpoCartao>
      </Cartao>

      <Cartao>
        <CabecalhoCartao
          titulo="Equipamento instalado"
          descricao="A unidade montada que está neste carro. Instalar tira a unidade do estoque; tirar devolve."
        />
        <CorpoCartao>
          <Grupo rotulo="Equipamento" htmlFor="montagemId" erro={erroNoCampo("montagemId")}>
            <Selecao id="montagemId" name="montagemId" defaultValue={carro?.montagemId ?? ""}>
              <option value="">Nenhum equipamento instalado</option>
              {montagens.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero} — {m.codigo} · {m.descricao} (montado em {data(m.montadaEm)})
                </option>
              ))}
            </Selecao>
          </Grupo>

          {montagens.length === 0 && (
            <p className="mt-2 text-xs text-texto-fraco">
              Nenhuma unidade pronta no estoque. Marque uma estrutura como montada na tela de
              Estrutura para poder instalar aqui.
            </p>
          )}
        </CorpoCartao>
      </Cartao>

      <Cartao>
        <CabecalhoCartao
          titulo="Versões em uso"
          descricao="O que está rodando neste carro hoje."
        />
        <CorpoCartao className="grid gap-4 sm:grid-cols-2">
          <Grupo rotulo="Sistema do PC" htmlFor="versaoSistemaId">
            <Selecao
              id="versaoSistemaId"
              name="versaoSistemaId"
              defaultValue={carro?.versaoSistemaId ?? ""}
            >
              <option value="">Não informada</option>
              {doTipo("sistema").map((v) => (
                <option key={v.id} value={v.id}>
                  {v.numero}
                </option>
              ))}
            </Selecao>
          </Grupo>

          <Grupo rotulo="App do tablet" htmlFor="versaoTabletId">
            <Selecao
              id="versaoTabletId"
              name="versaoTabletId"
              defaultValue={carro?.versaoTabletId ?? ""}
            >
              <option value="">Não informada</option>
              {doTipo("tablet").map((v) => (
                <option key={v.id} value={v.id}>
                  {v.numero}
                </option>
              ))}
            </Selecao>
          </Grupo>
        </CorpoCartao>
      </Cartao>

      {estado.erro && !estado.campo ? (
        <p className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2 text-sm text-perigo">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {estado.erro}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {carro && podeExcluir ? (
          <BotaoConfirmar
            rotulo="Excluir carro"
            Icone={Trash2}
            className="text-perigo hover:bg-perigo-suave hover:text-perigo"
            titulo="Excluir carro"
            descricao={carro.placa}
            rotuloConfirmar="Excluir"
            aoConfirmar={aoExcluir}
          >
            <p>
              O carro sai da frota. Se ele tem equipamento instalado, a montagem continua
              registrada e volta a aparecer como disponível no estoque.
            </p>
          </BotaoConfirmar>
        ) : (
          <span />
        )}

        <Botao type="submit" variante="salvar" disabled={salvando}>
          {salvando ? <LoaderCircle className="animate-spin" /> : carro ? <Save /> : <Car />}
          {carro ? "Salvar alterações" : "Cadastrar carro"}
        </Botao>
      </div>
    </form>
  );
}
