"use client";

import { AlertCircle, LoaderCircle, MessageCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import {
  excluirFornecedor,
  salvarFornecedor,
  type EstadoFornecedor,
} from "@/lib/acoes/fornecedores";
import { opcoes, STATUS_FORNECEDOR } from "@/lib/labels";

export type DadosFornecedor = {
  id: string;
  nome: string;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  condicaoPagamento: string | null;
  frete: string | null;
  status: string;
  observacoes: string | null;
  ativo: boolean;
};

/** Link do WhatsApp a partir de um telefone brasileiro digitado de qualquer jeito. */
function linkWhatsapp(telefone: string) {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}`;
}

export function FormularioFornecedor({
  fornecedor,
  podeExcluir,
}: {
  fornecedor?: DadosFornecedor;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [estado, acao, salvando] = useActionState<EstadoFornecedor, FormData>(
    salvarFornecedor,
    {},
  );
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? "");
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  useEffect(() => {
    if (estado.ok) router.push("/fornecedores");
  }, [estado.ok, router]);

  const whatsapp = linkWhatsapp(telefone);
  const erroNoCampo = (campo: string) => (estado.campo === campo ? estado.erro : undefined);

  async function aoExcluir() {
    if (!fornecedor) return;
    if (!confirm(`Excluir o fornecedor ${fornecedor.nome}?`)) return;
    const r = await excluirFornecedor(fornecedor.id);
    if (r.erro) setErroExcluir(r.erro);
    else router.push("/fornecedores");
  }

  return (
    <form action={acao} className="space-y-5">
      {fornecedor && <input type="hidden" name="id" value={fornecedor.id} />}

      <Cartao>
        <CabecalhoCartao titulo="Dados do fornecedor" />
        <CorpoCartao className="grid gap-4 sm:grid-cols-2">
          <Grupo rotulo="Nome" obrigatorio htmlFor="nome" erro={erroNoCampo("nome")} className="sm:col-span-2">
            <Entrada
              id="nome"
              name="nome"
              defaultValue={fornecedor?.nome ?? ""}
              placeholder="Razão social ou nome da loja"
              required
              autoFocus
            />
          </Grupo>

          <Grupo rotulo="Pessoa de contato" htmlFor="contato">
            <Entrada id="contato" name="contato" defaultValue={fornecedor?.contato ?? ""} />
          </Grupo>

          <Grupo rotulo="Telefone / WhatsApp" htmlFor="telefone">
            <div className="flex gap-2">
              <Entrada
                id="telefone"
                name="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 90000-0000"
              />
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <Botao type="button" variante="salvar" tamanho="icone" title="Abrir no WhatsApp">
                    <MessageCircle className="size-4" />
                  </Botao>
                </a>
              )}
            </div>
          </Grupo>

          <Grupo rotulo="E-mail" htmlFor="email" erro={erroNoCampo("email")}>
            <Entrada id="email" name="email" type="email" defaultValue={fornecedor?.email ?? ""} />
          </Grupo>

          <Grupo rotulo="Site / loja" htmlFor="site">
            <Entrada id="site" name="site" type="url" defaultValue={fornecedor?.site ?? ""} placeholder="https://" />
          </Grupo>

          <Grupo rotulo="Condição de pagamento" htmlFor="condicaoPagamento">
            <Entrada
              id="condicaoPagamento"
              name="condicaoPagamento"
              defaultValue={fornecedor?.condicaoPagamento ?? ""}
              placeholder="Ex.: 30/60 dias, boleto"
            />
          </Grupo>

          <Grupo rotulo="Frete / retirada" htmlFor="frete">
            <Entrada
              id="frete"
              name="frete"
              defaultValue={fornecedor?.frete ?? ""}
              placeholder="Ex.: CIF, retirada no local"
            />
          </Grupo>

          <Grupo rotulo="Status" htmlFor="status">
            <Selecao id="status" name="status" defaultValue={fornecedor?.status ?? "em_avaliacao"}>
              {opcoes(STATUS_FORNECEDOR).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </Grupo>

          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-texto-suave">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={fornecedor?.ativo ?? true}
              className="size-4 accent-[var(--marca)]"
            />
            Fornecedor ativo
          </label>

          <Grupo rotulo="Observações" htmlFor="observacoes" className="sm:col-span-2">
            <AreaTexto
              id="observacoes"
              name="observacoes"
              defaultValue={fornecedor?.observacoes ?? ""}
              rows={3}
            />
          </Grupo>
        </CorpoCartao>
      </Cartao>

      {(estado.erro || erroExcluir) && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-perigo-suave px-4 py-3 text-sm font-medium text-perigo"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erroExcluir ?? estado.erro}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Botao type="button" variante="suave" onClick={() => router.push("/fornecedores")}>
            Cancelar
          </Botao>
          {fornecedor && podeExcluir && (
            <Botao
              type="button"
              variante="fantasma"
              onClick={aoExcluir}
              className="text-perigo hover:bg-perigo-suave hover:text-perigo"
            >
              <Trash2 className="size-4" />
              Excluir
            </Botao>
          )}
        </div>

        <Botao type="submit" variante="salvar" tamanho="lg" disabled={salvando}>
          {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {salvando ? "Salvando..." : fornecedor ? "Salvar alterações" : "Cadastrar fornecedor"}
        </Botao>
      </div>
    </form>
  );
}
