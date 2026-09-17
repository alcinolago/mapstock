"use client";

import { AlertCircle, EyeOff, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import type { Dependencias } from "@/lib/exclusao";

/**
 * Excluir mostrando o que está em jogo antes do clique.
 *
 * O `confirm()` do navegador não sabia dizer "isto apaga 3 movimentações"
 * nem oferecer desativar como saída — e desativar é o caminho certo quando o
 * registro já apareceu num pedido ou numa montagem. As duas telas que
 * excluem (item e fornecedor) usam este mesmo diálogo.
 */
export function BotaoExcluir({
  oQue,
  nome,
  ativo,
  dependencias,
  excluir,
  desativar,
  aoConcluir,
}: {
  /** "item" ou "fornecedor" — entra nas frases do diálogo. */
  oQue: string;
  nome: string;
  ativo: boolean;
  dependencias: () => Promise<Dependencias>;
  excluir: () => Promise<{ erro?: string }>;
  desativar: () => Promise<void>;
  aoConcluir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [deps, setDeps] = useState<Dependencias | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setAberto(true);
    setDeps(null);
    setErro(null);
    try {
      setDeps(await dependencias());
    } catch {
      setErro("Não foi possível verificar os vínculos. Tente de novo.");
    }
  }

  async function confirmarExclusao() {
    setOcupado(true);
    setErro(null);
    const r = await excluir();
    setOcupado(false);
    if (r.erro) setErro(r.erro);
    else aoConcluir();
  }

  async function confirmarDesativar() {
    setOcupado(true);
    setErro(null);
    await desativar();
    setOcupado(false);
    aoConcluir();
  }

  const bloqueado = (deps?.bloqueios.length ?? 0) > 0;

  return (
    <>
      <Botao
        type="button"
        variante="fantasma"
        onClick={abrir}
        className="text-perigo hover:bg-perigo-suave hover:text-perigo"
      >
        <Trash2 className="size-4" />
        Excluir
      </Botao>

      <Modal
        titulo={bloqueado ? `Não dá para excluir este ${oQue}` : `Excluir ${oQue}`}
        descricao={nome}
        icone={
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              bloqueado ? "bg-alerta-suave text-alerta" : "bg-perigo-suave text-perigo"
            }`}
          >
            {bloqueado ? <ShieldAlert className="size-4" /> : <Trash2 className="size-4" />}
          </span>
        }
        aberto={aberto}
        aoFechar={() => !ocupado && setAberto(false)}
        centralizado
        className="sm:max-w-lg"
        rodape={
          <>
            <Botao
              type="button"
              variante="suave"
              onClick={() => setAberto(false)}
              disabled={ocupado}
            >
              Cancelar
            </Botao>

            {ativo && (
              <Botao
                type="button"
                variante={bloqueado ? "primario" : "contorno"}
                onClick={confirmarDesativar}
                disabled={ocupado || !deps}
              >
                <EyeOff className="size-4" />
                Desativar
              </Botao>
            )}

            <Botao
              type="button"
              variante="perigo"
              onClick={confirmarExclusao}
              disabled={ocupado || !deps || bloqueado}
            >
              {ocupado ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Excluir definitivamente
            </Botao>
          </>
        }
      >
        {!deps && !erro && (
          <p className="flex items-center gap-2 py-6 text-sm text-texto-fraco">
            <LoaderCircle className="size-4 animate-spin" />
            Conferindo onde este {oQue} é usado...
          </p>
        )}

        {deps && (
          <div className="space-y-4 text-sm leading-relaxed">
            {bloqueado ? (
              <>
                <p className="text-texto-suave">
                  Este {oQue} está vinculado a outros registros do sistema e, por isso, não
                  pode ser excluído.
                </p>
                <Lista titulo="Onde está vinculado" linhas={deps.bloqueios} tom="alerta" />
                <p className="text-texto-fraco">
                  <strong className="font-semibold text-texto-suave">Desativar</strong> tira
                  das listas e dos seletores sem perder nada do histórico.
                </p>
              </>
            ) : (
              <>
                <p className="text-texto-suave">
                  Não está em nenhuma cotação, pedido nem montagem. A exclusão é definitiva e
                  não tem desfazer.
                </p>
                {deps.junto.length > 0 && (
                  <Lista titulo="Some junto" linhas={deps.junto} tom="perigo" />
                )}
                <p className="text-texto-fraco">
                  Se a ideia é só tirar de circulação,{" "}
                  <strong className="font-semibold text-texto-suave">desativar</strong> mantém
                  tudo como está.
                </p>
              </>
            )}
          </div>
        )}

        {erro && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl bg-perigo-suave px-4 py-3 text-sm font-medium text-perigo"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </Modal>
    </>
  );
}

/** Contagem em destaque à esquerda do rótulo: o número é o que decide. */
function Lista({
  titulo,
  linhas,
  tom,
}: {
  titulo: string;
  linhas: { rotulo: string; quantidade: number }[];
  tom: "perigo" | "alerta";
}) {
  return (
    <div className="rounded-xl border border-borda bg-superficie-2 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-fraco">
        {titulo}
      </p>
      <ul className="mt-2 space-y-1.5">
        {linhas.map((l) => (
          <li key={l.rotulo} className="flex items-center gap-2.5 text-texto-suave">
            <span
              className={`num inline-flex min-w-7 justify-center rounded-md px-1.5 py-0.5 text-xs font-bold ${
                tom === "perigo"
                  ? "bg-perigo-suave text-perigo"
                  : "bg-alerta-suave text-alerta"
              }`}
            >
              {l.quantidade}
            </span>
            {l.rotulo}
          </li>
        ))}
      </ul>
    </div>
  );
}
