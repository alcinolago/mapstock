"use client";

import { AlertCircle, LoaderCircle, type LucideIcon } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";

import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Tom = "perigo" | "alerta" | "marca";

const SELO: Record<Tom, string> = {
  perigo: "bg-perigo-suave text-perigo",
  alerta: "bg-alerta-suave text-alerta",
  marca: "bg-marca-suave text-marca",
};

const VARIANTE_CONFIRMAR: Record<Tom, ComponentProps<typeof Botao>["variante"]> = {
  perigo: "perigo",
  alerta: "movimento",
  marca: "primario",
};

/**
 * Pergunta antes de agir — a mesma janela em toda a aplicação.
 *
 * Substitui o `confirm()` do navegador, que ignorava o tema, não formatava
 * nada (o texto vinha com \n no meio), não cabia o contexto da decisão e, em
 * alguns navegadores, some de vez quando a pessoa marca "não mostrar mais" —
 * e aí a ação passava a acontecer sem pergunta nenhuma.
 *
 * O erro da ação volta para dentro da janela em vez de um `alert()` solto: a
 * janela fica aberta, a pessoa lê o motivo e decide de novo.
 */
export function BotaoConfirmar({
  rotulo,
  Icone,
  variante = "fantasma",
  tamanho,
  className,
  iconeClassName,
  dica,
  desabilitado,
  titulo,
  descricao,
  tom = "perigo",
  rotuloConfirmar,
  somenteIcone,
  aoConfirmar,
  children,
}: {
  /** Texto do botão e rótulo acessível quando ele é só ícone. */
  rotulo: string;
  Icone: LucideIcon;
  variante?: ComponentProps<typeof Botao>["variante"];
  tamanho?: ComponentProps<typeof Botao>["tamanho"];
  className?: string;
  iconeClassName?: string;
  /** `title` do botão, quando precisa dizer mais que o rótulo. */
  dica?: string;
  desabilitado?: boolean;
  titulo: string;
  descricao?: string;
  tom?: Tom;
  rotuloConfirmar?: string;
  somenteIcone?: boolean;
  /** Devolver `{ erro }` mantém a janela aberta com a mensagem. */
  aoConfirmar: () => Promise<{ erro?: string } | void>;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setOcupado(true);
    setErro(null);
    const r = await aoConfirmar();
    setOcupado(false);
    if (r?.erro) setErro(r.erro);
    else setAberto(false);
  }

  return (
    <>
      <Botao
        type="button"
        variante={variante}
        tamanho={tamanho}
        className={className}
        disabled={desabilitado}
        title={dica ?? rotulo}
        aria-label={somenteIcone ? rotulo : undefined}
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        <Icone className={cn("size-4", iconeClassName)} />
        {!somenteIcone && rotulo}
      </Botao>

      <Modal
        titulo={titulo}
        descricao={descricao}
        icone={
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              SELO[tom],
            )}
          >
            <Icone className="size-4" />
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
            <Botao
              type="button"
              variante={VARIANTE_CONFIRMAR[tom]}
              onClick={confirmar}
              disabled={ocupado}
            >
              {ocupado ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Icone className="size-4" />
              )}
              {rotuloConfirmar ?? rotulo}
            </Botao>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-texto-suave">{children}</div>

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
