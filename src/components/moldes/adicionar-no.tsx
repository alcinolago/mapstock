"use client";

import { AlertCircle, LoaderCircle, Plus, X } from "lucide-react";
import { useActionState, useMemo, useState, useTransition } from "react";

import { SeletorItem, type ItemBusca } from "@/components/estoque/seletor-item";
import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoNumero } from "@/components/ui/campo-mascarado";
import { Modal } from "@/components/ui/modal";
import { MiniaturaItem } from "@/components/itens/miniatura-item";
import { adicionarNo, adicionarPecas, type EstadoNo } from "@/lib/acoes/moldes";

export type OpcaoDivisao = { id: string; nome: string };

/**
 * Acrescenta uma divisao ou uma peca dentro de um no do molde.
 *
 * As duas coisas moram na mesma janela porque, na cabeca de quem monta, o
 * gesto e um so: "o que mais entra aqui?". A escolha entre divisao e peca e
 * um par de abas, nao duas telas diferentes.
 *
 * Peca se escolhe varias de uma vez: marca-se na busca, cada uma cai numa
 * linha com a propria quantidade, e um clique so grava todas. A receita de
 * um domo tem vinte pecas, e uma janela por peca era abrir e fechar vinte
 * vezes. Divisao continua uma por vez — sao tres ou quatro por estrutura.
 */

type PecaEscolhida = { itemId: string; quantidade: string; localMontagem: string };
export function AdicionarNo({
  moldeId,
  paiId,
  paiNome,
  divisoes,
  itens,
  compacto = false,
  aoAdicionar,
}: {
  moldeId: string;
  /** Nulo = direto na raiz do molde. */
  paiId: string | null;
  paiNome: string;
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  compacto?: boolean;
  /* A árvore nasce recolhida; quem acabou de pôr algo dentro de uma divisão
     precisa vê-la abrir, senão o clique parece não ter feito nada. */
  aoAdicionar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"divisao" | "peca">("divisao");
  const [pecas, setPecas] = useState<PecaEscolhida[]>([]);
  const [erroPecas, setErroPecas] = useState<string>();
  const [gravandoPecas, iniciar] = useTransition();
  const [divisaoId, setDivisaoId] = useState("");
  const [chave, setChave] = useState(0);
  const [tratado, setTratado] = useState<EstadoNo | null>(null);
  const [estado, acao, enviando] = useActionState<EstadoNo, FormData>(adicionarNo, {});

  if (estado.ok && estado !== tratado) {
    setTratado(estado);
    aoAdicionar?.();
    setAberto(false);
    setDivisaoId("");
    setChave((k) => k + 1);
  }

  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const marcados = useMemo(() => new Set(pecas.map((p) => p.itemId)), [pecas]);

  function alternarPeca(id: string) {
    setErroPecas(undefined);
    setPecas((atual) =>
      atual.some((p) => p.itemId === id)
        ? atual.filter((p) => p.itemId !== id)
        : [...atual, { itemId: id, quantidade: "1", localMontagem: "" }],
    );
  }

  function mudarPeca(id: string, mudanca: Partial<PecaEscolhida>) {
    setPecas((atual) => atual.map((p) => (p.itemId === id ? { ...p, ...mudanca } : p)));
  }

  function gravarPecas() {
    iniciar(async () => {
      const r = await adicionarPecas({ moldeId, paiId, pecas });
      if (r.erro) {
        setErroPecas(r.erro);
        return;
      }
      aoAdicionar?.();
      setAberto(false);
      setPecas([]);
      setErroPecas(undefined);
    });
  }

  const idFormulario = `no-${paiId ?? "raiz"}`;
  const ocupado = enviando || gravandoPecas;
  /* Quantidade vazia ou zero barra aqui mesmo: a action recusaria a lista
     inteira por causa de uma linha. */
  const pecasValidas =
    pecas.length > 0 && pecas.every((p) => Number(p.quantidade.replace(",", ".")) > 0);

  return (
    <>
      {compacto ? (
        <Botao
          variante="fantasma"
          tamanho="sm"
          onClick={() => setAberto(true)}
          title={`Adicionar dentro de ${paiNome}`}
          aria-label={`Adicionar dentro de ${paiNome}`}
          className="px-1.5"
        >
          <Plus className="size-3.5" />
        </Botao>
      ) : (
        <Botao variante="contorno" tamanho="sm" onClick={() => setAberto(true)}>
          <Plus className="size-4" />
          Adicionar
        </Botao>
      )}

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Adicionar à estrutura"
        descricao={`dentro de ${paiNome}`}
        centralizado
        rodape={
          <>
            <Botao variante="suave" onClick={() => setAberto(false)} disabled={ocupado}>
              Cancelar
            </Botao>
            {aba === "divisao" ? (
              <Botao type="submit" form={idFormulario} disabled={ocupado || !divisaoId}>
                {enviando ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {enviando ? "Salvando..." : "Adicionar"}
              </Botao>
            ) : (
              <Botao type="button" onClick={gravarPecas} disabled={ocupado || !pecasValidas}>
                {gravandoPecas ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {gravandoPecas
                  ? "Salvando..."
                  : pecas.length > 1
                    ? `Adicionar ${pecas.length} peças`
                    : "Adicionar"}
              </Botao>
            )}
          </>
        }
      >
        <form
          id={idFormulario}
          action={acao}
          key={chave}
          /* O formulário só envia divisão. Na aba de peças, um Enter num campo
             da lista mandaria a divisão vazia e voltaria erro sem sentido. */
          onSubmit={(e) => aba === "peca" && e.preventDefault()}
          className="space-y-4"
        >
          <input type="hidden" name="moldeId" value={moldeId} />
          <input type="hidden" name="paiId" value={paiId ?? ""} />
          <input type="hidden" name="divisaoId" value={divisaoId} />

          <div className="flex gap-1 rounded-lg bg-superficie-2 p-1">
            {(["divisao", "peca"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAba(v)}
                className={
                  aba === v
                    ? "flex-1 rounded-md bg-superficie px-3 py-1.5 text-sm font-semibold text-texto shadow-sm"
                    : "flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-texto-fraco hover:text-texto"
                }
              >
                {v === "divisao" ? "Divisão" : "Peça do estoque"}
              </button>
            ))}
          </div>

          {aba === "divisao" ? (
            <Grupo
              rotulo="Divisão"
              obrigatorio
              htmlFor={`${idFormulario}-div`}
              ajuda="Agrupador. Não é item e nunca entra no estoque — cadastre novos nomes na tela Divisões."
            >
              <Selecao
                id={`${idFormulario}-div`}
                value={divisaoId}
                onChange={(e) => setDivisaoId(e.target.value)}
              >
                <option value="">Escolha...</option>
                {divisoes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </Selecao>
            </Grupo>
          ) : (
            <>
              <Grupo
                rotulo="Peças"
                obrigatorio
                ajuda="Marque quantas quiser — a lista fica aberta. Saem do estoque na hora de montar, nunca antes."
              >
                <SeletorItem
                  itens={itens}
                  marcados={marcados}
                  aoEscolher={alternarPeca}
                  nome="itemIdVisual"
                  placeholder={
                    pecas.length > 0
                      ? `${pecas.length} ${pecas.length === 1 ? "peça marcada" : "peças marcadas"} — buscar mais...`
                      : "Buscar e marcar peças por código ou descrição..."
                  }
                />
              </Grupo>

              {pecas.length > 0 && (
                <ul className="divide-y divide-borda rounded-lg border border-borda">
                  {pecas.map((p) => {
                    const item = porId.get(p.itemId);
                    return (
                      <li key={p.itemId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <MiniaturaItem
                          fotoId={item?.fotoId}
                          descricao={item?.descricao ?? ""}
                          className="size-7"
                        />
                        <div className="min-w-0 flex-1 basis-40">
                          <span className="codigo block text-xs font-semibold text-marca">
                            {item?.codigo}
                          </span>
                          <span className="block truncate text-xs text-texto-suave">
                            {item?.descricao}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CampoNumero
                            valor={p.quantidade}
                            aoMudar={(v) => mudarPeca(p.itemId, { quantidade: v })}
                            aria-label={`Quantidade de ${item?.codigo}`}
                            className="h-8 w-20 text-right text-sm"
                          />
                          <span className="w-10 text-xs text-texto-fraco">{item?.unidade}</span>
                        </div>
                        <Entrada
                          value={p.localMontagem}
                          onChange={(e) => mudarPeca(p.itemId, { localMontagem: e.target.value })}
                          placeholder="Local de montagem"
                          aria-label={`Local de montagem de ${item?.codigo}`}
                          className="h-8 w-44 text-sm"
                        />
                        <Botao
                          type="button"
                          variante="fantasma"
                          tamanho="sm"
                          onClick={() => alternarPeca(p.itemId)}
                          className="hover:bg-perigo-suave hover:text-perigo"
                        >
                          <X className="size-3.5" />
                          Tirar
                        </Botao>
                      </li>
                    );
                  })}
                </ul>
              )}

              {erroPecas && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {erroPecas}
                </p>
              )}
            </>
          )}

          {/* Na aba de peças cada linha tem a sua quantidade e o seu local;
              estes dois ficam só para a divisão. */}
          {aba === "divisao" && (
            <>
              <Grupo rotulo="Quantidade" obrigatorio htmlFor={`${idFormulario}-qtd`}>
                <CampoNumero
                  id={`${idFormulario}-qtd`}
                  name="quantidade"
                  padrao="1"
                  required
                  className="w-32"
                />
              </Grupo>

              <Grupo rotulo="Local de montagem" htmlFor={`${idFormulario}-local`}>
                <Entrada
                  id={`${idFormulario}-local`}
                  name="localMontagem"
                  placeholder="Ex.: face traseira, painel elétrico"
                />
              </Grupo>
            </>
          )}

          {estado.erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2.5 text-sm font-medium text-perigo"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {estado.erro}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
