"use client";

import {
  Ban,
  Check,
  ExternalLink,
  PackageCheck,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada } from "@/components/ui/campo";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Selo } from "@/components/ui/selo";
import {
  cancelarPedido,
  devolverItemDoPedido,
  receberItemDoPedido,
  salvarParametrosCompra,
} from "@/lib/acoes/compras";
import type { LinhaPedidoCompleta } from "@/db/consultas";
import type { StatusPedido } from "@/lib/labels";
import { moeda, numero, paraNumero } from "@/lib/utils";

/**
 * As linhas do pedido em cartoes, nao em tabela.
 *
 * Era uma tabela ate o PDF existir. O que mudou: cada linha agora carrega
 * link do produto e um texto livre de parametros de compra, e isso nao cabe
 * numa celula sem virar rolagem horizontal — justamente o que incomodava na
 * tela de 13 polegadas. Em cartao, o mesmo conteudo desce em vez de esticar,
 * e a tela funciona igual no celular e no tablet.
 */
export function ItensPedido({
  pedidoId,
  linhas,
  frete,
  podeEditar,
  status,
}: {
  pedidoId: string;
  linhas: LinhaPedidoCompleta[];
  frete: number;
  podeEditar: boolean;
  status: StatusPedido;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});

  const subtotal = linhas.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);

  /* Cancelado tranca a linha inteira; recebido não — é justamente depois de
     receber que a devolução passa a fazer sentido. */
  const cancelado = status === "cancelado";
  const encerrado = cancelado || status === "recebido";

  function receber(linha: LinhaPedidoCompleta) {
    const falta = linha.quantidade - linha.recebida;
    const q = paraNumero(quantidades[linha.id] ?? String(falta), falta);
    iniciar(async () => {
      const r = await receberItemDoPedido(linha.id, q);
      if (r.erro) alert(r.erro);
      else {
        setQuantidades((s) => ({ ...s, [linha.id]: "" }));
        router.refresh();
      }
    });
  }

  async function cancelar() {
    const r = await cancelarPedido(pedidoId);
    if (r.erro) return r;
    router.refresh();
  }

  async function devolver(linha: LinhaPedidoCompleta) {
    const r = await devolverItemDoPedido(linha.id);
    if (r.erro) return r;
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {linhas.map((l) => {
        const falta = l.quantidade - l.recebida;
        const completo = falta <= 0;
        const devolvido = l.devolvida > 0;

        return (
          <article key={l.id} className="rounded-xl border border-borda bg-superficie p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/itens/${l.itemId}`}
                  className="codigo text-sm font-semibold text-marca hover:underline"
                >
                  {l.codigo}
                </Link>
                <p className="text-sm text-texto">{l.descricao}</p>
              </div>

              {devolvido ? (
                <Selo tom="neutro">Devolvido</Selo>
              ) : completo ? (
                <Selo tom="ok">Recebido</Selo>
              ) : l.recebida > 0 ? (
                <Selo tom="alerta">Faltam {numero(falta)}</Selo>
              ) : (
                <Selo tom="info">A receber</Selo>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <Dado rotulo="Quantidade" valor={`${numero(l.quantidade)} ${l.unidade}`} />
              <Dado rotulo="Preço un." valor={moeda(l.precoUnitario)} />
              <Dado rotulo="Total" valor={moeda(l.quantidade * l.precoUnitario)} />
              <Dado
                rotulo="Recebido"
                valor={`${numero(l.recebida)} de ${numero(l.quantidade)}`}
              />
              {l.sku && <Dado rotulo="Código no fornecedor" valor={l.sku} />}
              {(l.qtdMinima ?? 0) > 0 && (
                <Dado
                  rotulo="Mínimo do fornecedor"
                  valor={`${numero(l.qtdMinima)} ${l.unidadeMinima ?? l.unidade}`}
                />
              )}
              {l.localizacao && <Dado rotulo="Onde guardar" valor={l.localizacao} />}
            </dl>

            {(l.linkFornecedor || l.linkCompra) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {l.linkFornecedor && (
                  <LinkProduto url={l.linkFornecedor} rotulo="Produto no fornecedor" />
                )}
                {l.linkCompra && l.linkCompra !== l.linkFornecedor && (
                  <LinkProduto url={l.linkCompra} rotulo="Link do cadastro" />
                )}
              </div>
            )}

            <ParametrosCompra
              pedidoItemId={l.id}
              valor={l.parametrosCompra ?? ""}
              podeEditar={podeEditar}
            />

            {podeEditar && !cancelado && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-borda pt-3">
                {!completo && !devolvido && (
                  <Entrada
                    value={quantidades[l.id] ?? ""}
                    onChange={(e) => setQuantidades((s) => ({ ...s, [l.id]: e.target.value }))}
                    placeholder={String(falta)}
                    inputMode="decimal"
                    className="num h-9 w-24 text-right"
                    aria-label={`Quantidade recebida de ${l.codigo}`}
                  />
                )}

                <Botao
                  variante="salvar"
                  tamanho="sm"
                  disabled={pendente || completo || devolvido}
                  onClick={() => receber(l)}
                >
                  <PackageCheck />
                  Receber
                </Botao>

                {/* Só existe depois que algo entrou: não se devolve o que
                    ainda não chegou. */}
                {l.recebida > 0 && (
                  <BotaoConfirmar
                    rotulo="Devolver"
                    Icone={Undo2}
                    variante="contorno"
                    tamanho="sm"
                    tom="alerta"
                    desabilitado={pendente || devolvido}
                    titulo="Devolver ao fornecedor"
                    descricao={`${l.codigo} — ${l.descricao}`}
                    rotuloConfirmar="Devolver tudo"
                    aoConfirmar={() => devolver(l)}
                  >
                    <p>
                      Devolve as{" "}
                      <strong className="font-semibold text-texto">
                        {numero(l.recebida)} {l.unidade}
                      </strong>{" "}
                      que já entraram por esta linha. A quantidade sai do estoque como
                      devolução, e o histórico do item passa a mostrar o que voltou.
                    </p>
                    <p className="text-texto-fraco">
                      A linha não volta a ficar disponível para receber — depois disto,
                      Receber e Devolver ficam indisponíveis nela.
                    </p>
                  </BotaoConfirmar>
                )}
              </div>
            )}
          </article>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-4 py-3">
        {podeEditar && !encerrado ? (
          <BotaoConfirmar
            rotulo="Cancelar pedido"
            Icone={Ban}
            desabilitado={pendente}
            className="text-perigo hover:bg-perigo-suave hover:text-perigo"
            titulo="Cancelar pedido"
            rotuloConfirmar="Cancelar o pedido"
            aoConfirmar={cancelar}
          >
            <p>
              O pedido sai do fluxo de compras e deixa de aceitar recebimento. O que já
              tiver sido recebido continua no estoque — cancelar não mexe em saldo.
            </p>
          </BotaoConfirmar>
        ) : (
          <span />
        )}

        <div className="text-right text-sm">
          <p className="text-texto-fraco">
            Itens {moeda(subtotal)}
            {frete > 0 && ` · frete ${moeda(frete)}`}
          </p>
          <p className="num text-lg font-bold text-texto">{moeda(subtotal + frete)}</p>
        </div>
      </div>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-texto-fraco">{rotulo}</dt>
      <dd className="num truncate text-sm text-texto">{valor}</dd>
    </div>
  );
}

function LinkProduto({ url, rotulo }: { url: string; rotulo: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-marca hover:underline"
    >
      <ExternalLink className="size-3.5 shrink-0" />
      <span className="truncate">{rotulo}</span>
    </a>
  );
}

/**
 * O campo que o pessoal de compras le no site do fornecedor: cor, tamanho,
 * voltagem, o kit de 50 em vez do avulso. Salva so quando a pessoa manda —
 * gravar sozinho no blur ja fez gente perder texto em rascunho.
 */
function ParametrosCompra({
  pedidoItemId,
  valor,
  podeEditar,
}: {
  pedidoItemId: string;
  valor: string;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [texto, setTexto] = useState(valor);
  const [salvo, setSalvo] = useState(false);

  const alterado = texto.trim() !== valor.trim();

  if (!podeEditar) {
    if (!valor) return null;
    return (
      <div className="mt-3 rounded-lg border-l-2 border-alerta bg-alerta-suave px-3 py-2">
        <p className="text-[11px] font-semibold tracking-wide text-alerta">
          O que escolher no site
        </p>
        <p className="mt-0.5 text-sm whitespace-pre-line text-texto">{valor}</p>
      </div>
    );
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarParametrosCompra(pedidoItemId, texto);
      if (r.erro) {
        alert(r.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-borda pt-3">
      <label
        htmlFor={`parametros-${pedidoItemId}`}
        className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-texto-suave"
      >
        <SlidersHorizontal className="size-3.5 text-alerta" />O que escolher no site do fornecedor
      </label>

      <AreaTexto
        id={`parametros-${pedidoItemId}`}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalvo(false);
        }}
        placeholder={'Ex.: variação "Preto / 10 peças", rosca M6, fonte 12 V. Sai em destaque no PDF de compras.'}
        className="mt-1.5 min-h-16"
      />

      <div className="mt-1.5 flex items-center justify-end gap-2">
        {salvo && !alterado && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok">
            <Check className="size-3.5" />
            Salvo
          </span>
        )}
        {alterado && (
          <>
            <Botao
              variante="fantasma"
              tamanho="sm"
              disabled={pendente}
              onClick={() => setTexto(valor)}
            >
              Descartar
            </Botao>
            <Botao variante="salvar" tamanho="sm" disabled={pendente} onClick={salvar}>
              Salvar parâmetros
            </Botao>
          </>
        )}
      </div>
    </div>
  );
}
