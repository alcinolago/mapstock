"use client";

import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campo";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Selo } from "@/components/ui/selo";
import { alternarDivisao, excluirDivisao } from "@/lib/acoes/divisoes";

export type Divisao = { id: string; nome: string; ativo: boolean; usos: number };

/**
 * As divisoes sao rotulos livres — Domo, Estrutura, Fiacao, Fixacao — e
 * valem para qualquer molde. Por isso vivem numa tela propria: elas nao
 * pertencem a equipamento nenhum, sao o vocabulario da oficina.
 */
export function PainelDivisoes({
  divisoes,
  podeEditar,
}: {
  divisoes: Divisao[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  function executar(fn: () => Promise<{ erro?: string }>, aoTerminar?: () => void) {
    iniciar(async () => {
      const r = await fn();
      setErro(r.erro ?? null);
      if (!r.erro) {
        aoTerminar?.();
        router.refresh();
      }
    });
  }

  async function renomear(id: string) {
    const dados = new FormData();
    dados.set("id", id);
    dados.set("nome", rascunho);
    const { salvarDivisao } = await import("@/lib/acoes/divisoes");
    return salvarDivisao({}, dados);
  }

  if (divisoes.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-texto-fraco">
        Nenhuma divisão ainda. Crie a primeira — Domo, Estrutura, Fiação, o nome que vocês usam
        na bancada.
      </p>
    );
  }

  return (
    <div>
      {erro && (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-lg bg-perigo-suave px-3 py-2 text-sm font-medium text-perigo"
        >
          {erro}
        </p>
      )}

      <ul className="divide-y divide-borda">
        {divisoes.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            {editando === d.id ? (
              <>
                <Entrada
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  className="h-8 flex-1 text-sm"
                  autoFocus
                />
                <Botao
                  variante="salvar"
                  tamanho="sm"
                  disabled={pendente || !rascunho.trim()}
                  onClick={() => executar(() => renomear(d.id), () => setEditando(null))}
                >
                  <Check className="size-3.5" />
                </Botao>
                <Botao variante="suave" tamanho="sm" onClick={() => setEditando(null)}>
                  <X className="size-3.5" />
                </Botao>
              </>
            ) : (
              <>
                <span
                  className={
                    d.ativo
                      ? "flex-1 text-sm font-medium text-texto"
                      : "flex-1 text-sm font-medium text-texto-fraco line-through"
                  }
                >
                  {d.nome}
                </span>

                <Selo tom={d.usos > 0 ? "marca" : "neutro"}>
                  {d.usos === 0
                    ? "sem uso"
                    : `${d.usos} ${d.usos === 1 ? "uso" : "usos"} em moldes`}
                </Selo>

                {podeEditar && (
                  <>
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      title="Renomear"
                      onClick={() => {
                        setRascunho(d.nome);
                        setEditando(d.id);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Botao>
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      disabled={pendente}
                      title={d.ativo ? "Desativar" : "Reativar"}
                      onClick={() => executar(() => alternarDivisao(d.id))}
                    >
                      {d.ativo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Botao>
                    <BotaoConfirmar
                      rotulo={`Excluir ${d.nome}`}
                      Icone={Trash2}
                      tamanho="sm"
                      somenteIcone
                      iconeClassName="size-3.5 text-perigo"
                      dica="Excluir divisão"
                      desabilitado={pendente}
                      titulo="Excluir divisão"
                      descricao={d.nome}
                      rotuloConfirmar="Excluir"
                      aoConfirmar={async () => {
                        const r = await excluirDivisao(d.id);
                        if (r.erro) return r;
                        router.refresh();
                      }}
                    >
                      <p>
                        {d.usos > 0
                          ? `Está em uso em ${d.usos} ${d.usos === 1 ? "lugar" : "lugares"} de algum molde, então a exclusão vai ser recusada. Desative para tirar da lista sem mexer nos moldes.`
                          : "Não está em nenhum molde. As montagens já feitas guardam o nome copiado, então o histórico não muda."}
                      </p>
                    </BotaoConfirmar>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NovaDivisao() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function criar() {
    iniciar(async () => {
      const dados = new FormData();
      dados.set("nome", nome);
      const { salvarDivisao } = await import("@/lib/acoes/divisoes");
      const r = await salvarDivisao({}, dados);
      setErro(r.erro ?? null);
      if (!r.erro) {
        setNome("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div>
        <Entrada
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && nome.trim() && criar()}
          placeholder="Nome da divisão"
          className="w-56"
        />
        {erro && <p className="mt-1 text-xs font-medium text-perigo">{erro}</p>}
      </div>
      <Botao disabled={pendente || !nome.trim()} onClick={criar}>
        <Plus className="size-4" />
        Criar divisão
      </Botao>
    </div>
  );
}
