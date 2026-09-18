"use client";

import { AlertCircle, Car, LoaderCircle, Plus, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Grupo, Selecao } from "@/components/ui/campo";
import { CampoNumero } from "@/components/ui/campo-mascarado";
import { CabecalhoCartao, Cartao } from "@/components/ui/cartao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { Selo } from "@/components/ui/selo";
import { ArvoreMontagem, type NoMontagem } from "./arvore-montagem";
import { MontarNo } from "./montar-no";
import {
  abrirMontagens,
  associarCarro,
  desmontarMontagem,
  excluirMontagem,
} from "@/lib/acoes/montagem";
import { STATUS_MONTAGEM } from "@/lib/labels";
import { data } from "@/lib/utils";
import type { TomSelo } from "@/components/ui/selo";

const TOM: Record<string, TomSelo> = {
  em_montagem: "alerta",
  montada: "ok",
  instalada: "marca",
  desmontada: "neutro",
};

export type MontagemNaTela = {
  id: string;
  numero: string;
  nome: string;
  status: string;
  local: string | null;
  observacoes: string | null;
  iniciadaEm: Date;
  montadaEm: Date | null;
  placa: string | null;
  carroId: string | null;
  etapas: number;
  etapasFeitas: number;
  nos: NoMontagem[];
};

export type OpcaoMolde = { id: string; nome: string; nos: number };
export type OpcaoCarro = { id: string; placa: string; ocupado: boolean };

export function PainelMontagem({
  montagens,
  carros,
  podeEditar,
}: {
  montagens: MontagemNaTela[];
  carros: OpcaoCarro[];
  podeEditar: boolean;
}) {
  if (montagens.length === 0) {
    return (
      <Cartao>
        <p className="px-4 py-14 text-center text-sm text-texto-fraco">
          Nenhuma montagem aberta. Escolha um molde em{" "}
          <strong className="font-semibold text-texto-suave">Abrir montagem</strong> e diga
          quantos equipamentos.
        </p>
      </Cartao>
    );
  }

  return (
    <div className="space-y-5">
      {montagens.map((m) => (
        <CartaoMontagem key={m.id} montagem={m} carros={carros} podeEditar={podeEditar} />
      ))}
    </div>
  );
}

function CartaoMontagem({
  montagem: m,
  carros,
  podeEditar,
}: {
  montagem: MontagemNaTela;
  carros: OpcaoCarro[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const encerrada = m.status === "desmontada";
  const completa = m.status === "montada" || m.status === "instalada";
  const tudoFeito = m.etapas > 0 && m.etapasFeitas === m.etapas;

  function trocarCarro(carroId: string) {
    iniciar(async () => {
      const r = await associarCarro(m.id, carroId || null);
      setErro(r.erro ?? null);
      if (!r.erro) router.refresh();
    });
  }

  return (
    <Cartao className="overflow-hidden">
      <CabecalhoCartao
        titulo={`${m.numero} — ${m.nome}`}
        descricao={`Aberta em ${data(m.iniciadaEm)}${m.montadaEm ? ` · concluída em ${data(m.montadaEm)}` : ""}${m.local ? ` · ${m.local}` : ""}`}
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <Selo tom={TOM[m.status] ?? "neutro"}>
              {STATUS_MONTAGEM[m.status as keyof typeof STATUS_MONTAGEM] ?? m.status}
            </Selo>

            {m.etapas > 0 && (
              <Selo tom={tudoFeito ? "ok" : "neutro"}>
                {m.etapasFeitas} de {m.etapas} {m.etapas === 1 ? "etapa" : "etapas"}
              </Selo>
            )}

            {m.placa && (
              <Selo tom="marca">
                <Car className="size-3" />
                {m.placa}
              </Selo>
            )}

            {podeEditar && !encerrada && !completa && tudoFeito && (
              <MontarNo
                montagemId={m.id}
                noId={null}
                rotulo="Concluir equipamento"
                variante="movimento"
              />
            )}

            {podeEditar && completa && (
              <Selecao
                aria-label="Carro"
                value={m.carroId ?? ""}
                disabled={pendente}
                onChange={(e) => trocarCarro(e.target.value)}
                className="h-8 w-auto min-w-40 text-xs"
              >
                <option value="">Sem carro</option>
                {carros
                  .filter((c) => !c.ocupado || c.id === m.carroId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.placa}
                    </option>
                  ))}
              </Selecao>
            )}

            {podeEditar && !encerrada && m.etapasFeitas > 0 && (
              <BotaoConfirmar
                rotulo={`Desmontar ${m.numero}`}
                Icone={Undo2}
                tamanho="sm"
                somenteIcone
                iconeClassName="size-3.5"
                dica="Desmontar e devolver ao estoque"
                desabilitado={pendente}
                titulo="Desmontar"
                descricao={`${m.numero} — ${m.nome}`}
                rotuloConfirmar="Desmontar"
                aoConfirmar={async () => {
                  const r = await desmontarMontagem(m.id);
                  if (r.erro) return r;
                  router.refresh();
                }}
              >
                <p>
                  Devolve ao estoque tudo que esta montagem consumiu, lançando o oposto de cada
                  movimento — nada é apagado. As etapas voltam a ficar em aberto.
                </p>
              </BotaoConfirmar>
            )}

            {podeEditar && m.etapasFeitas === 0 && (
              <BotaoConfirmar
                rotulo={`Excluir ${m.numero}`}
                Icone={Trash2}
                tamanho="sm"
                somenteIcone
                iconeClassName="size-3.5 text-perigo"
                dica="Excluir montagem"
                desabilitado={pendente}
                titulo="Excluir montagem"
                descricao={`${m.numero} — ${m.nome}`}
                rotuloConfirmar="Excluir"
                aoConfirmar={async () => {
                  const r = await excluirMontagem(m.id);
                  if (r.erro) return r;
                  router.refresh();
                }}
              >
                <p>Nada foi consumido ainda, então some sem deixar rastro no estoque.</p>
              </BotaoConfirmar>
            )}
          </div>
        }
      />

      {erro && (
        <p
          role="alert"
          className="mx-4 mt-3 rounded-lg bg-perigo-suave px-3 py-2 text-sm font-medium text-perigo"
        >
          {erro}
        </p>
      )}

      <ArvoreMontagem
        montagemId={m.id}
        nos={m.nos}
        podeEditar={podeEditar}
        encerrada={encerrada || completa}
      />
    </Cartao>
  );
}

export function AbrirMontagem({ moldes }: { moldes: OpcaoMolde[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [moldeId, setMoldeId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const disponiveis = moldes.filter((m) => m.nos > 0);

  function confirmar() {
    iniciar(async () => {
      const r = await abrirMontagens(moldeId, Number(quantidade.replace(",", ".")));
      setErro(r.erro ?? null);
      if (!r.erro) {
        setAberto(false);
        setMoldeId("");
        setQuantidade("1");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Abrir montagem
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Abrir montagem"
        descricao="Cada equipamento vira uma árvore própria, montada no seu ritmo."
        centralizado
        rodape={
          <>
            <Botao variante="suave" onClick={() => setAberto(false)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao onClick={confirmar} disabled={pendente || !moldeId}>
              {pendente ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Abrir
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Grupo rotulo="Equipamento" obrigatorio htmlFor="abrir-molde">
            {disponiveis.length === 0 ? (
              <p className="rounded-lg bg-superficie-2 px-3 py-2.5 text-sm text-texto-fraco">
                Nenhum molde com estrutura montada. Crie um em Estrutura e coloque pelo menos uma
                divisão dentro.
              </p>
            ) : (
              <Selecao
                id="abrir-molde"
                value={moldeId}
                onChange={(e) => setMoldeId(e.target.value)}
              >
                <option value="">Escolha...</option>
                {disponiveis.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Grupo>

          <Grupo
            rotulo="Quantos equipamentos"
            obrigatorio
            htmlFor="abrir-qtd"
            ajuda="Três equipamentos abrem três árvores independentes, uma para cada unidade."
          >
            <CampoNumero
              id="abrir-qtd"
              inteiro
              valor={quantidade}
              aoMudar={setQuantidade}
              className="w-28"
            />
          </Grupo>

          <p className="text-xs leading-relaxed text-texto-fraco">
            Abrir não mexe no estoque e não depende de ter peça: a árvore é uma cópia do molde,
            congelada agora. Só ao montar cada divisão é que as peças saem.
          </p>

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {erro}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
