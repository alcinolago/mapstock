"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campo";
import { Selo } from "@/components/ui/selo";
import {
  adicionarNivel,
  adicionarRegra,
  removerClassificacao,
  removerLocal,
  removerNivel,
  removerRegra,
  removerUnidade,
  renomearNivel,
  salvarClassificacao,
  salvarLocal,
  salvarUnidade,
} from "@/lib/acoes/configuracoes";

type Resultado = { erro?: string; ok?: boolean };

function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const executar = (fn: () => Promise<Resultado>, aoTerminar?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      setErro(r.erro ?? null);
      if (!r.erro) {
        aoTerminar?.();
        router.refresh();
      }
    });

  return { pendente, erro, setErro, executar };
}

/* Estes painéis editam na propria linha, sem <form> em volta — entao o
   `required` do navegador nunca dispara. A trava fica no botao, com a mesma
   regra que a action aplica do outro lado, para a recusa aparecer antes da
   ida ao servidor em vez de depois. */
const classificacaoCompleta = (r: { nome: string; prefixoCodigo: string }) =>
  Boolean(r.nome.trim()) && /^[A-Za-z]{2,5}$/.test(r.prefixoCodigo.trim());

const unidadeCompleta = (r: { sigla: string; nome: string }) =>
  Boolean(r.sigla.trim()) && Boolean(r.nome.trim());

function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p role="alert" className="rounded-lg bg-perigo-suave px-3 py-2 text-sm font-medium text-perigo">
      {texto}
    </p>
  );
}

/* --------------------------------------------------------------- Níveis --- */

export function PainelNiveis({ niveis }: { niveis: { num: number; nome: string }[] }) {
  const { pendente, erro, executar } = useAcao();
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [novo, setNovo] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-fraco">
        Os degraus da estrutura. O Nível 0 é o equipamento montado e não entra no controle de falta.
      </p>

      <Erro texto={erro} />

      <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
        {niveis.map((n) => (
          <li key={n.num} className="flex items-center gap-3 px-4 py-2.5">
            <Selo tom={n.num === 0 ? "marca" : "neutro"}>Nível {n.num}</Selo>

            {editando === n.num ? (
              <>
                <Entrada
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  placeholder="Nome do nível *"
                  required
                  className="h-8 flex-1 text-sm"
                  autoFocus
                />
                <Botao
                  variante="salvar"
                  tamanho="sm"
                  disabled={pendente || !rascunho.trim()}
                  onClick={() => executar(() => renomearNivel(n.num, rascunho), () => setEditando(null))}
                >
                  <Check className="size-3.5" />
                </Botao>
                <Botao variante="suave" tamanho="sm" onClick={() => setEditando(null)}>
                  <X className="size-3.5" />
                </Botao>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-texto">{n.nome}</span>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => {
                    setRascunho(n.nome);
                    setEditando(n.num);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Botao>
                {n.num > 0 && (
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    disabled={pendente}
                    onClick={() => executar(() => removerNivel(n.num))}
                  >
                    <Trash2 className="size-3.5 text-perigo" />
                  </Botao>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Entrada
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Nome do novo nível *"
          required
          className="max-w-64"
        />
        <Botao
          variante="contorno"
          disabled={pendente || !novo.trim()}
          onClick={() => executar(() => adicionarNivel(novo), () => setNovo(""))}
        >
          <Plus className="size-4" />
          Adicionar
        </Botao>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Classificações --- */

export type Classificacao = {
  id: string;
  nome: string;
  prefixoCodigo: string;
  ativo: boolean;
  regras: { id: string; palavraChave: string }[];
};

export function PainelClassificacoes({ lista }: { lista: Classificacao[] }) {
  const { pendente, erro, executar } = useAcao();
  const [editando, setEditando] = useState<string | "nova" | null>(null);
  const [rascunho, setRascunho] = useState({ nome: "", prefixoCodigo: "", ativo: true });
  const [novaRegra, setNovaRegra] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-fraco">
        O prefixo entra no código sugerido (<span className="codigo">FIX</span> vira{" "}
        <span className="codigo">FIX-PAR-M6X20</span>). As palavras-chave são o que faz a
        classificação se preencher sozinha a partir da descrição.
      </p>

      <Erro texto={erro} />

      <div className="space-y-2">
        {lista.map((c) => (
          <div key={c.id} className="rounded-xl border border-borda p-3">
            {editando === c.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <Entrada
                  value={rascunho.nome}
                  onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
                  className="h-9 min-w-48 flex-1 text-sm"
                  placeholder="Nome *"
                  required
                  autoFocus
                />
                <Entrada
                  value={rascunho.prefixoCodigo}
                  onChange={(e) =>
                    setRascunho((r) => ({ ...r, prefixoCodigo: e.target.value.toUpperCase() }))
                  }
                  className="codigo h-9 w-24 text-sm"
                  placeholder="FIX *"
                  required
                  maxLength={5}
                />
                <label className="flex h-9 items-center gap-2 text-xs text-texto-suave">
                  <input
                    type="checkbox"
                    checked={rascunho.ativo}
                    onChange={(e) => setRascunho((r) => ({ ...r, ativo: e.target.checked }))}
                    className="size-4 accent-[var(--marca)]"
                  />
                  Ativa
                </label>
                <Botao
                  variante="salvar"
                  tamanho="sm"
                  disabled={pendente || !classificacaoCompleta(rascunho)}
                  onClick={() =>
                    executar(() => salvarClassificacao({ id: c.id, ...rascunho }), () => setEditando(null))
                  }
                >
                  <Check className="size-3.5" />
                </Botao>
                <Botao variante="suave" tamanho="sm" onClick={() => setEditando(null)}>
                  <X className="size-3.5" />
                </Botao>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="codigo rounded bg-marca-suave px-2 py-0.5 text-xs font-bold text-marca">
                  {c.prefixoCodigo}
                </span>
                <span className="flex-1 text-sm font-medium text-texto">{c.nome}</span>
                {!c.ativo && <Selo tom="neutro">inativa</Selo>}
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => {
                    setRascunho({ nome: c.nome, prefixoCodigo: c.prefixoCodigo, ativo: c.ativo });
                    setEditando(c.id);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  disabled={pendente}
                  onClick={() => executar(() => removerClassificacao(c.id))}
                >
                  <Trash2 className="size-3.5 text-perigo" />
                </Botao>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-borda pt-2">
              {c.regras.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded-full bg-superficie-2 py-0.5 pr-1 pl-2.5 text-xs font-medium text-texto-suave"
                >
                  {r.palavraChave}
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => executar(() => removerRegra(r.id))}
                    aria-label={`Remover ${r.palavraChave}`}
                    className="rounded-full p-0.5 text-texto-fraco transition-colors hover:text-perigo"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              <Entrada
                value={novaRegra[c.id] ?? ""}
                onChange={(e) => setNovaRegra((s) => ({ ...s, [c.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const palavra = novaRegra[c.id] ?? "";
                    if (palavra.trim()) {
                      executar(
                        () => adicionarRegra(c.id, palavra),
                        () => setNovaRegra((s) => ({ ...s, [c.id]: "" })),
                      );
                    }
                  }
                }}
                placeholder="+ palavra-chave"
                className="h-7 w-36 text-xs"
                aria-label={`Nova palavra-chave para ${c.nome}`}
              />
            </div>
          </div>
        ))}
      </div>

      {editando === "nova" ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-marca/40 bg-marca-suave/20 p-3">
          <Entrada
            value={rascunho.nome}
            onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
            className="h-9 min-w-48 flex-1 text-sm"
            placeholder="Nome da classificação *"
            required
            autoFocus
          />
          <Entrada
            value={rascunho.prefixoCodigo}
            onChange={(e) =>
              setRascunho((r) => ({ ...r, prefixoCodigo: e.target.value.toUpperCase() }))
            }
            className="codigo h-9 w-24 text-sm"
            placeholder="FIX *"
            required
            maxLength={5}
          />
          <Botao
            variante="salvar"
            tamanho="sm"
            disabled={pendente || !classificacaoCompleta(rascunho)}
            onClick={() => executar(() => salvarClassificacao(rascunho), () => setEditando(null))}
          >
            <Check className="size-3.5" />
            Criar
          </Botao>
          <Botao variante="suave" tamanho="sm" onClick={() => setEditando(null)}>
            <X className="size-3.5" />
          </Botao>
        </div>
      ) : (
        <Botao
          variante="contorno"
          onClick={() => {
            setRascunho({ nome: "", prefixoCodigo: "", ativo: true });
            setEditando("nova");
          }}
        >
          <Plus className="size-4" />
          Nova classificação
        </Botao>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Unidades --- */

export function PainelUnidades({
  lista,
}: {
  lista: { id: string; sigla: string; nome: string; ativo: boolean }[];
}) {
  const { pendente, erro, executar } = useAcao();
  const [editando, setEditando] = useState<string | "nova" | null>(null);
  const [rascunho, setRascunho] = useState({ sigla: "", nome: "", ativo: true });

  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-fraco">Como cada item é contado: unidade, quilo, metro, rolo.</p>

      <Erro texto={erro} />

      <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
        {lista.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
            {editando === u.id ? (
              <>
                <Entrada
                  value={rascunho.sigla}
                  onChange={(e) => setRascunho((r) => ({ ...r, sigla: e.target.value }))}
                  placeholder="Sigla *"
                  required
                  className="h-8 w-24 text-sm"
                  autoFocus
                />
                <Entrada
                  value={rascunho.nome}
                  onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
                  placeholder="Nome por extenso *"
                  required
                  className="h-8 flex-1 text-sm"
                />
                <Botao
                  variante="salvar"
                  tamanho="sm"
                  disabled={pendente || !unidadeCompleta(rascunho)}
                  onClick={() =>
                    executar(() => salvarUnidade({ id: u.id, ...rascunho }), () => setEditando(null))
                  }
                >
                  <Check className="size-3.5" />
                </Botao>
                <Botao variante="suave" tamanho="sm" onClick={() => setEditando(null)}>
                  <X className="size-3.5" />
                </Botao>
              </>
            ) : (
              <>
                <span className="codigo w-16 text-sm font-semibold text-texto">{u.sigla}</span>
                <span className="flex-1 text-sm text-texto-suave">{u.nome}</span>
                {!u.ativo && <Selo tom="neutro">inativa</Selo>}
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => {
                    setRascunho({ sigla: u.sigla, nome: u.nome, ativo: u.ativo });
                    setEditando(u.id);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  disabled={pendente}
                  onClick={() => executar(() => removerUnidade(u.id))}
                >
                  <Trash2 className="size-3.5 text-perigo" />
                </Botao>
              </>
            )}
          </li>
        ))}
      </ul>

      {editando === "nova" ? (
        <div className="flex gap-2 rounded-xl border border-marca/40 bg-marca-suave/20 p-3">
          <Entrada
            value={rascunho.sigla}
            onChange={(e) => setRascunho((r) => ({ ...r, sigla: e.target.value }))}
            placeholder="Sigla *"
            required
            className="w-24"
            autoFocus
          />
          <Entrada
            value={rascunho.nome}
            onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
            placeholder="Nome por extenso *"
            required
            className="max-w-64"
          />
          <Botao
            variante="salvar"
            disabled={pendente || !unidadeCompleta(rascunho)}
            onClick={() => executar(() => salvarUnidade(rascunho), () => setEditando(null))}
          >
            <Check className="size-4" />
            Criar
          </Botao>
          <Botao variante="suave" onClick={() => setEditando(null)}>
            <X className="size-4" />
          </Botao>
        </div>
      ) : (
        <Botao
          variante="contorno"
          onClick={() => {
            setRascunho({ sigla: "", nome: "", ativo: true });
            setEditando("nova");
          }}
        >
          <Plus className="size-4" />
          Nova unidade
        </Botao>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Locais --- */

/**
 * Onde a peca fica guardada. Virou cadastro para o item so escolher de uma
 * lista: texto livre fazia "Gaveta B3" e "gaveta b3" virarem dois lugares, e
 * af filtrar por prateleira nao fechava.
 */
export function PainelLocais({
  lista,
}: {
  lista: { id: string; nome: string; ativo: boolean }[];
}) {
  const { pendente, erro, executar } = useAcao();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [rascunho, setRascunho] = useState({ nome: "", ativo: true });

  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-fraco">
        Prateleira, gaveta, armário, sala. O cadastro de item escolhe daqui — não dá para
        digitar um lugar novo por lá, e é isso que evita o mesmo lugar com dois nomes.
      </p>

      <Erro texto={erro} />

      <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
        {lista.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-texto-fraco">
            Nenhum local cadastrado ainda.
          </li>
        )}
        {lista.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
            {editando === l.id ? (
              <>
                <Entrada
                  value={rascunho.nome}
                  onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
                  placeholder="Nome do local *"
                  required
                  className="h-8 flex-1 text-sm"
                  autoFocus
                />
                <label className="flex items-center gap-2 text-xs text-texto-suave">
                  <input
                    type="checkbox"
                    checked={rascunho.ativo}
                    onChange={(e) => setRascunho((r) => ({ ...r, ativo: e.target.checked }))}
                    className="size-4 accent-[var(--marca)]"
                  />
                  Ativo
                </label>
                <Botao
                  variante="salvar"
                  tamanho="sm"
                  disabled={pendente || !rascunho.nome.trim()}
                  onClick={() =>
                    executar(() => salvarLocal({ id: l.id, ...rascunho }), () => setEditando(null))
                  }
                >
                  <Check className="size-3.5" />
                </Botao>
                <Botao variante="suave" tamanho="sm" onClick={() => setEditando(null)}>
                  <X className="size-3.5" />
                </Botao>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-texto">{l.nome}</span>
                {!l.ativo && <Selo tom="neutro">inativo</Selo>}
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => {
                    setRascunho({ nome: l.nome, ativo: l.ativo });
                    setEditando(l.id);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  disabled={pendente}
                  onClick={() => executar(() => removerLocal(l.id))}
                >
                  <Trash2 className="size-3.5 text-perigo" />
                </Botao>
              </>
            )}
          </li>
        ))}
      </ul>

      {editando === "novo" ? (
        <div className="flex gap-2 rounded-xl border border-marca/40 bg-marca-suave/20 p-3">
          <Entrada
            value={rascunho.nome}
            onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
            placeholder="Ex.: Prateleira A1 *"
            required
            className="max-w-72"
            autoFocus
          />
          <Botao
            variante="salvar"
            disabled={pendente || !rascunho.nome.trim()}
            onClick={() => executar(() => salvarLocal(rascunho), () => setEditando(null))}
          >
            <Check className="size-4" />
            Criar
          </Botao>
          <Botao variante="suave" onClick={() => setEditando(null)}>
            <X className="size-4" />
          </Botao>
        </div>
      ) : (
        <Botao
          variante="contorno"
          onClick={() => {
            setRascunho({ nome: "", ativo: true });
            setEditando("novo");
          }}
        >
          <Plus className="size-4" />
          Novo local
        </Botao>
      )}
    </div>
  );
}
