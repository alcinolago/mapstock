"use client";

import { AlertCircle, LoaderCircle, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { salvarFornecedor, type EstadoFornecedor } from "@/lib/acoes/fornecedores";
import { STATUS_FORNECEDOR } from "@/lib/labels";

/**
 * Cadastra um fornecedor sem sair do cadastro de item.
 *
 * Existe por um relato de quem usa: no meio do cadastro de um item, quem
 * ainda nao tinha fornecedor clicava no "cadastre em Fornecedores", ia para
 * outra tela e voltava com o formulario do item inteiro em branco. Meia hora
 * de digitacao perdida por um link.
 *
 * So os campos que identificam o fornecedor. O resto — frete, condicao de
 * pagamento, observacoes — se completa depois na tela propria, e nao vale
 * segurar quem esta no meio de outra tarefa.
 */
export function NovoFornecedor({
  aoCriar,
  compacto = false,
}: {
  /** Recebe o fornecedor recém-criado, para a tela já o deixar escolhido. */
  aoCriar: (fornecedor: { id: string; nome: string }) => void;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [chave, setChave] = useState(0);
  const [tratado, setTratado] = useState<EstadoFornecedor | null>(null);
  const [estado, acao, enviando] = useActionState<EstadoFornecedor, FormData>(
    salvarFornecedor,
    {},
  );

  if (estado.ok && estado.id && estado !== tratado) {
    setTratado(estado);
    aoCriar({ id: estado.id, nome });
    setAberto(false);
    setNome("");
    setChave((k) => k + 1);
  }

  return (
    <>
      <Botao
        type="button"
        variante={compacto ? "contorno" : "primario"}
        tamanho="sm"
        onClick={() => setAberto(true)}
      >
        <Plus className="size-4" />
        Novo fornecedor
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo fornecedor"
        descricao="O cadastro do item continua aqui atrás, do jeito que você deixou."
        centralizado
        rodape={
          <>
            <Botao
              type="button"
              variante="suave"
              onClick={() => setAberto(false)}
              disabled={enviando}
            >
              Cancelar
            </Botao>
            <Botao type="submit" form="novo-fornecedor" disabled={enviando || !nome.trim()}>
              {enviando ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {enviando ? "Salvando..." : "Criar e vincular"}
            </Botao>
          </>
        }
      >
        {/* Sem <form> aninhado: esta janela sai num portal para o <body>,
            então ela nunca nasce dentro do formulário do item. */}
        <form id="novo-fornecedor" action={acao} key={chave} className="space-y-4">
          <input type="hidden" name="ativo" value="true" />

          <Grupo rotulo="Nome" obrigatorio htmlFor="nf-nome" erro={estado.campo === "nome" ? estado.erro : undefined}>
            <Entrada
              id="nf-nome"
              name="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Parafusos Silva"
              required
              autoFocus
            />
          </Grupo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Grupo rotulo="Contato" htmlFor="nf-contato">
              <Entrada id="nf-contato" name="contato" placeholder="Nome de quem atende" />
            </Grupo>
            <Grupo rotulo="Telefone" htmlFor="nf-telefone">
              <Entrada id="nf-telefone" name="telefone" placeholder="11988887777" />
            </Grupo>
            <Grupo
              rotulo="E-mail"
              htmlFor="nf-email"
              erro={estado.campo === "email" ? estado.erro : undefined}
            >
              <Entrada id="nf-email" name="email" type="email" placeholder="vendas@empresa.com.br" />
            </Grupo>
            <Grupo rotulo="Site" htmlFor="nf-site">
              <Entrada id="nf-site" name="site" placeholder="https://..." />
            </Grupo>
          </div>

          <Grupo rotulo="Situação" htmlFor="nf-status">
            <Selecao id="nf-status" name="status" defaultValue="em_avaliacao">
              {Object.entries(STATUS_FORNECEDOR).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Selecao>
          </Grupo>

          <p className="text-xs text-texto-fraco">
            Condição de pagamento, frete e observações você completa depois em Fornecedores.
          </p>

          {estado.erro && !estado.campo && (
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
