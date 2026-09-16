"use client";

import { AlertTriangle, Check, Hammer, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Grupo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { Selo } from "@/components/ui/selo";
import type { ComponenteDaMontagem } from "@/db/consultas";
import { montarEstrutura, verificarMontagem } from "@/lib/acoes/montagens";
import { numero } from "@/lib/utils";

/**
 * Marcar uma estrutura como montada.
 *
 * A modal existe porque montar não é só mudar um campo: sai peça do estoque
 * e entra equipamento pronto. Antes de confirmar, a pessoa vê exatamente o
 * que vai ser consumido e o que está faltando — foi o que o pessoal pediu
 * para não descobrir na bancada que faltava parafuso.
 */
export function Montar({
  itemId,
  codigo,
  descricao,
}: {
  itemId: string;
  codigo: string;
  descricao: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pendente, iniciar] = useTransition();

  const [componentes, setComponentes] = useState<ComponenteDaMontagem[]>([]);
  const [opcionais, setOpcionais] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function abrir() {
    setAberto(true);
    setErro(null);
    setFeito(null);
    setCarregando(true);
    const lista = await verificarMontagem(itemId);
    setComponentes(lista);
    /* Opcional entra marcado quando há saldo: é o caso comum, e desmarcar dá
       menos trabalho do que lembrar de marcar. */
    setOpcionais(
      new Set(
        lista.filter((c) => !c.obrigatorio && c.disponivel >= c.necessario).map((c) => c.itemId),
      ),
    );
    setCarregando(false);
  }

  const aConsumir = componentes.filter((c) => c.obrigatorio || opcionais.has(c.itemId));
  const faltando = aConsumir.filter((c) => c.disponivel < c.necessario);
  const podeMontar = componentes.length > 0 && faltando.length === 0;

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await montarEstrutura(itemId, {
        local,
        observacoes,
        opcionais: [...opcionais],
      });

      if (r.faltando) {
        /* Alguém consumiu a peça entre abrir a modal e confirmar. */
        setComponentes((atual) =>
          atual.map((c) => r.faltando!.find((f) => f.itemId === c.itemId) ?? c),
        );
        setErro("O estoque mudou enquanto esta janela estava aberta. Confira o que falta.");
        return;
      }
      if (r.erro) {
        setErro(r.erro);
        return;
      }

      setFeito(r.numero ?? null);
      setLocal("");
      setObservacoes("");
      router.refresh();
    });
  }

  return (
    <>
      <Botao
        variante="movimento"
        tamanho="sm"
        onClick={abrir}
        title={`Marcar ${codigo} como montada`}
      >
        <Hammer />
        Montar
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Montar ${codigo}`}
        descricao={descricao}
        rodape={
          feito ? (
            <Botao variante="contorno" onClick={() => setAberto(false)}>
              Fechar
            </Botao>
          ) : (
            <>
              <Botao variante="fantasma" onClick={() => setAberto(false)} disabled={pendente}>
                Cancelar
              </Botao>
              <Botao
                variante="salvar"
                onClick={confirmar}
                disabled={!podeMontar || pendente || carregando}
              >
                {pendente ? <LoaderCircle className="animate-spin" /> : <Hammer />}
                Confirmar montagem
              </Botao>
            </>
          )
        }
      >
        {carregando ? (
          <p className="py-8 text-center text-sm text-texto-fraco">Conferindo o estoque...</p>
        ) : feito ? (
          <div className="py-6 text-center">
            <Selo tom="ok">
              <Check className="size-3.5" />
              {feito}
            </Selo>
            <p className="mt-3 text-sm text-texto">
              {codigo} montado e disponível no estoque.
            </p>
            <p className="mt-1 text-xs text-texto-fraco">
              As peças consumidas saíram do estoque e aparecem no histórico com a referência{" "}
              {feito}.
            </p>
          </div>
        ) : componentes.length === 0 ? (
          <p className="py-6 text-center text-sm text-texto-fraco">
            {codigo} não tem componentes cadastrados na estrutura. Monte a árvore antes de marcar
            como montada.
          </p>
        ) : (
          <div className="space-y-4">
            {erro && (
              <p className="flex items-start gap-2 rounded-lg bg-perigo-suave px-3 py-2 text-sm text-perigo">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {erro}
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-texto-suave">
                SAI DO ESTOQUE AO CONFIRMAR
              </p>

              <ul className="divide-y divide-borda rounded-lg border border-borda">
                {componentes.map((c) => {
                  const incluido = c.obrigatorio || opcionais.has(c.itemId);
                  const falta = incluido && c.disponivel < c.necessario;

                  return (
                    <li key={c.itemId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      {!c.obrigatorio && (
                        <input
                          type="checkbox"
                          checked={opcionais.has(c.itemId)}
                          onChange={(e) =>
                            setOpcionais((atual) => {
                              const novo = new Set(atual);
                              if (e.target.checked) novo.add(c.itemId);
                              else novo.delete(c.itemId);
                              return novo;
                            })
                          }
                          aria-label={`Incluir ${c.codigo} nesta montagem`}
                          className="size-4 accent-[var(--marca)]"
                        />
                      )}

                      <span className="codigo shrink-0 text-xs font-semibold text-texto">
                        {c.codigo}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-texto-fraco">
                        {c.descricao}
                      </span>

                      {!c.obrigatorio && <Selo tom="neutro">opcional</Selo>}

                      <span className="num shrink-0 text-xs text-texto-suave">
                        {numero(c.necessario)} {c.unidade}
                      </span>

                      {falta ? (
                        <Selo tom="perigo">
                          faltam {numero(c.necessario - c.disponivel)}
                        </Selo>
                      ) : incluido ? (
                        <Selo tom="ok">em estoque</Selo>
                      ) : (
                        <Selo tom="neutro">fora</Selo>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {faltando.length > 0 && (
              <div className="rounded-lg border-l-2 border-alerta bg-alerta-suave px-3 py-2">
                <p className="text-xs font-semibold text-alerta">
                  Falta peça para montar esta estrutura
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-texto">
                  {faltando.map((c) => (
                    <li key={c.itemId}>
                      {c.codigo}: tem {numero(c.disponivel)}, precisa de {numero(c.necessario)}
                      {c.temEstrutura && " — este conjunto também pode ser montado antes"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Grupo
                rotulo="Onde ficou"
                htmlFor={`local-${itemId}`}
                ajuda="Prateleira, bancada ou a placa do carro. Dá para trocar depois."
              >
                <Entrada
                  id={`local-${itemId}`}
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Ex.: Prateleira A2 ou ABC1D23"
                />
              </Grupo>

              <Grupo rotulo="Observações" htmlFor={`obs-${itemId}`}>
                <AreaTexto
                  id={`obs-${itemId}`}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="min-h-10"
                  placeholder="O que fugiu do padrão nesta montagem"
                />
              </Grupo>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
