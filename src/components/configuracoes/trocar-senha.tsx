"use client";

import { Check, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo } from "@/components/ui/campo";
import { trocarMinhaSenha } from "@/lib/acoes/configuracoes";

export function TrocarSenha() {
  const [pendente, iniciar] = useTransition();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  function salvar() {
    if (nova !== confirma) {
      setErro("A confirmação não bate com a nova senha.");
      return;
    }
    iniciar(async () => {
      const r = await trocarMinhaSenha(atual, nova);
      if (r.erro) {
        setErro(r.erro);
        setPronto(false);
      } else {
        setErro(null);
        setPronto(true);
        setAtual("");
        setNova("");
        setConfirma("");
      }
    });
  }

  return (
    <div className="max-w-sm space-y-4">
      <p className="text-sm text-texto-fraco">
        Troque a senha de acesso da sua conta. Mínimo de 6 caracteres.
      </p>

      <Grupo rotulo="Senha atual" obrigatorio>
        <Entrada
          type="password"
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          autoComplete="current-password"
        />
      </Grupo>

      <Grupo rotulo="Nova senha" obrigatorio>
        <Entrada
          type="password"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          autoComplete="new-password"
        />
      </Grupo>

      <Grupo rotulo="Confirme a nova senha" obrigatorio>
        <Entrada
          type="password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          autoComplete="new-password"
        />
      </Grupo>

      {erro && (
        <p role="alert" className="rounded-lg bg-perigo-suave px-3 py-2 text-sm font-medium text-perigo">
          {erro}
        </p>
      )}

      {pronto && (
        <p className="flex items-center gap-2 rounded-lg bg-ok-suave px-3 py-2 text-sm font-medium text-ok">
          <Check className="size-4" />
          Senha alterada.
        </p>
      )}

      <Botao
        onClick={salvar}
        disabled={pendente || !atual || !nova || !confirma}
      >
        <KeyRound className="size-4" />
        Trocar senha
      </Botao>
    </div>
  );
}
