"use client";

import { Check, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoSenha } from "@/components/ui/campo-senha";
import { Selo } from "@/components/ui/selo";
import {
  Cabecalho,
  Celula,
  Coluna,
  Corpo,
  Linha,
  RolagemTabela,
  Tabela,
} from "@/components/ui/tabela";
import { salvarUsuario } from "@/lib/acoes/configuracoes";
import { opcoes, PAPEIS, type PapelUsuario } from "@/lib/labels";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
};

const VAZIO = { nome: "", email: "", papel: "editor" as PapelUsuario, ativo: true, senha: "" };

export function PainelUsuarios({ usuarios }: { usuarios: Usuario[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [rascunho, setRascunho] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  function abrirNovo() {
    setRascunho(VAZIO);
    setEditando("novo");
    setErro(null);
  }

  function abrirEdicao(u: Usuario) {
    setRascunho({ nome: u.nome, email: u.email, papel: u.papel, ativo: u.ativo, senha: "" });
    setEditando(u.id);
    setErro(null);
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarUsuario({
        id: editando === "novo" ? undefined : editando!,
        ...rascunho,
      });
      if (r.erro) setErro(r.erro);
      else {
        setEditando(null);
        setErro(null);
        router.refresh();
      }
    });
  }

  /* Sem <form> em volta, o `required` nao dispara sozinho — a mesma regra do
     `esquemaUsuario` fica aqui para a recusa acontecer antes da ida. Senha so
     e exigida no cadastro novo; em branco na edicao mantem a atual. */
  const podeSalvar =
    Boolean(rascunho.nome.trim()) &&
    Boolean(rascunho.email.trim()) &&
    (editando !== "novo" || rascunho.senha.length >= 6);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-texto-fraco">
          Quem pode entrar no sistema e o que cada um pode fazer.
        </p>
        {editando === null && (
          <Botao tamanho="sm" onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo usuário
          </Botao>
        )}
      </div>

      {editando !== null && (
        <div className="space-y-4 rounded-xl border border-marca/40 bg-marca-suave/20 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Grupo rotulo="Nome" obrigatorio>
              <Entrada
                value={rascunho.nome}
                onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
                required
                autoFocus
              />
            </Grupo>
            <Grupo rotulo="E-mail" obrigatorio>
              <Entrada
                type="email"
                value={rascunho.email}
                onChange={(e) => setRascunho((r) => ({ ...r, email: e.target.value }))}
                required
              />
            </Grupo>
            <Grupo rotulo="Perfil">
              <Selecao
                value={rascunho.papel}
                onChange={(e) =>
                  setRascunho((r) => ({ ...r, papel: e.target.value as PapelUsuario }))
                }
              >
                {opcoes(PAPEIS).map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </Selecao>
            </Grupo>
            <Grupo
              rotulo={editando === "novo" ? "Senha" : "Nova senha"}
              obrigatorio={editando === "novo"}
              ajuda={editando === "novo" ? "Mínimo 6 caracteres" : "Deixe em branco para manter a atual"}
            >
              <CampoSenha
                value={rascunho.senha}
                onChange={(e) => setRascunho((r) => ({ ...r, senha: e.target.value }))}
                autoComplete="new-password"
              />
            </Grupo>
          </div>

          <label className="flex items-center gap-2 text-sm text-texto-suave">
            <input
              type="checkbox"
              checked={rascunho.ativo}
              onChange={(e) => setRascunho((r) => ({ ...r, ativo: e.target.checked }))}
              className="size-4 accent-[var(--marca)]"
            />
            Acesso ativo
          </label>

          {erro && (
            <p role="alert" className="rounded-lg bg-perigo-suave px-3 py-2 text-sm font-medium text-perigo">
              {erro}
            </p>
          )}

          <div className="flex gap-2">
            <Botao
              variante="salvar"
              tamanho="sm"
              onClick={salvar}
              disabled={pendente || !podeSalvar}
            >
              <Check className="size-4" />
              Salvar
            </Botao>
            <Botao variante="suave" tamanho="sm" onClick={() => setEditando(null)}>
              <X className="size-4" />
              Cancelar
            </Botao>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-borda">
        <RolagemTabela>
          <Tabela>
            <Cabecalho>
              <tr>
                <Coluna>Nome</Coluna>
                <Coluna>E-mail</Coluna>
                <Coluna>Perfil</Coluna>
                <Coluna>Situação</Coluna>
                <Coluna />
              </tr>
            </Cabecalho>
            <Corpo>
              {usuarios.map((u) => (
                <Linha key={u.id}>
                  <Celula className="font-medium">{u.nome}</Celula>
                  <Celula className="text-xs text-texto-suave">{u.email}</Celula>
                  <Celula>
                    <Selo tom={u.papel === "admin" ? "marca" : "neutro"}>{PAPEIS[u.papel]}</Selo>
                  </Celula>
                  <Celula>
                    <Selo tom={u.ativo ? "ok" : "perigo"}>{u.ativo ? "Ativo" : "Desativado"}</Selo>
                  </Celula>
                  <Celula className="text-right">
                    <Botao variante="fantasma" tamanho="sm" onClick={() => abrirEdicao(u)}>
                      <Pencil className="size-3.5" />
                    </Botao>
                  </Celula>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        </RolagemTabela>
      </div>
    </div>
  );
}
