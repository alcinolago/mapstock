"use client";

import { AlertCircle, LoaderCircle, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { FornecedoresItem, type VinculoFornecedor } from "./fornecedores-item";
import { FotosItem } from "./fotos-item";
import { PARAMS_3D_PADRAO, Parametros3D, type Params3D } from "./parametros-3d";
import { BotaoExcluir } from "@/components/exclusao/botao-excluir";
import { Abas } from "@/components/ui/abas";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoNumero } from "@/components/ui/campo-mascarado";
import { CabecalhoCartao, Cartao, CorpoCartao } from "@/components/ui/cartao";
import {
  alternarAtivoItem,
  dependenciasItem,
  excluirItem,
  salvarItem,
  sugerirCodigo,
  type EstadoItem,
} from "@/lib/acoes/itens";
import { classificarPorRegras } from "@/lib/codigo";
import {
  AQUISICOES,
  opcoes,
  ORIGENS,
  ORIGENS_3D,
  type OrigemFabricacao,
} from "@/lib/labels";

export type DadosItem = {
  id: string;
  codigo: string;
  descricao: string;
  classificacaoId: string;
  unidadeId: string;
  aquisicao: string | null;
  origemFabricacao: string | null;
  estoqueMinimo: number;
  localId: string | null;
  observacoes: string | null;
  fichaTecnica: string | null;
  ativo: boolean;
  vinculos: VinculoFornecedor[];
  /* So os ids: os bytes ficam no banco e chegam por /api/fotos. */
  fotos: string[];
  parametros3d: Params3D | null;
};

type Props = {
  classificacoes: { id: string; nome: string; prefixoCodigo: string }[];
  unidades: { id: string; sigla: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
  locais: { id: string; nome: string; ativo: boolean }[];
  regras: { classificacaoId: string; palavraChave: string }[];
  item?: DadosItem;
  podeExcluir: boolean;
};

export function FormularioItem({
  classificacoes,
  unidades,
  fornecedores,
  locais,
  regras,
  item,
  podeExcluir,
}: Props) {
  const router = useRouter();
  const [estado, acao, salvando] = useActionState<EstadoItem, FormData>(salvarItem, {});

  const [codigo, setCodigo] = useState(item?.codigo ?? "");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [classificacaoId, setClassificacaoId] = useState(item?.classificacaoId ?? "");
  const [origem, setOrigem] = useState(item?.origemFabricacao ?? "");
  const [vinculos, setVinculos] = useState<VinculoFornecedor[]>(item?.vinculos ?? []);
  const [params3d, setParams3d] = useState<Params3D>(item?.parametros3d ?? PARAMS_3D_PADRAO);
  const [dica, setDica] = useState<string | null>(null);

  /* Espelha os flags code_auto / class_auto do desktop: a sugestao continua
     acontecendo ate a pessoa digitar o proprio valor, e a partir dai para. */
  const codigoAuto = useRef(!item);
  const classeAuto = useRef(!item);

  const editando = Boolean(item);
  const mostra3d = ORIGENS_3D.includes(origem as OrigemFabricacao);

  /* Classificacao sugerida pela descricao. Roda na propria digitacao, nao
     num efeito: e resposta direta a uma acao da pessoa. As regras vem do
     banco, entao isso resolve no cliente, sem ida ao servidor. */
  function descricaoMudou(texto: string) {
    setDescricao(texto);
    if (!classeAuto.current || !texto.trim()) return;
    const sugerida = classificarPorRegras(texto, regras);
    if (sugerida) setClassificacaoId(sugerida);
  }

  /* Codigo sugerido. Vai ao servidor porque precisa saber quais ja existem. */
  useEffect(() => {
    if (!codigoAuto.current || !descricao.trim() || !classificacaoId) return;
    const t = setTimeout(async () => {
      const novo = await sugerirCodigo(descricao, classificacaoId);
      if (novo && codigoAuto.current) {
        setCodigo(novo);
        setDica(`Código sugerido: ${novo}. Você pode editar.`);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [descricao, classificacaoId]);

  useEffect(() => {
    if (estado.ok) router.push("/itens");
  }, [estado.ok, router]);

  async function regerarCodigo() {
    codigoAuto.current = true;
    const novo = await sugerirCodigo(descricao, classificacaoId);
    if (novo) {
      setCodigo(novo);
      setDica(`Código sugerido: ${novo}. Você pode editar.`);
    }
  }

  const erroNoCampo = (campo: string) => (estado.campo === campo ? estado.erro : undefined);

  return (
    <form action={acao} className="space-y-5 pb-24">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="fornecedores" value={JSON.stringify(paraEnvio(vinculos))} />
      <input
        type="hidden"
        name="parametros3d"
        value={mostra3d ? JSON.stringify(params3d) : "null"}
      />

      {/* ------------------------------------------------ Identificação */}
      <Cartao>
        <CabecalhoCartao
          titulo="Identificação"
          descricao="O código e a classificação são sugeridos pela descrição — e podem ser trocados."
        />
        <CorpoCartao className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Grupo
            rotulo="Descrição"
            obrigatorio
            htmlFor="descricao"
            erro={erroNoCampo("descricao")}
            className="lg:col-span-3"
          >
            <Entrada
              id="descricao"
              name="descricao"
              value={descricao}
              onChange={(e) => descricaoMudou(e.target.value)}
              placeholder="Ex.: Parafuso M6x20 inox allen"
              required
              autoFocus={!editando}
            />
          </Grupo>

          <Grupo
            rotulo="Código"
            obrigatorio
            htmlFor="codigo"
            erro={erroNoCampo("codigo")}
            ajuda={dica}
          >
            <div className="flex gap-2">
              <Entrada
                id="codigo"
                name="codigo"
                value={codigo}
                onChange={(e) => {
                  codigoAuto.current = false;
                  setCodigo(e.target.value.toUpperCase());
                  setDica(null);
                }}
                className="codigo font-semibold"
                required
              />
              <Botao
                type="button"
                variante="contorno"
                tamanho="icone"
                onClick={regerarCodigo}
                title="Gerar código a partir da descrição"
                disabled={!descricao.trim() || !classificacaoId}
              >
                <Sparkles className="size-4" />
              </Botao>
            </div>
          </Grupo>

          <Grupo rotulo="Classificação" obrigatorio htmlFor="classificacaoId">
            <Selecao
              id="classificacaoId"
              name="classificacaoId"
              value={classificacaoId}
              onChange={(e) => {
                classeAuto.current = false;
                setClassificacaoId(e.target.value);
              }}
              required
            >
              <option value="">Selecione...</option>
              {classificacoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.prefixoCodigo})
                </option>
              ))}
            </Selecao>
          </Grupo>

          <Grupo rotulo="Unidade" obrigatorio htmlFor="unidadeId">
            <Selecao
              id="unidadeId"
              name="unidadeId"
              defaultValue={item?.unidadeId ?? ""}
              required
            >
              <option value="">Selecione...</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.sigla} — {u.nome}
                </option>
              ))}
            </Selecao>
          </Grupo>


          <Grupo rotulo="Aquisição" htmlFor="aquisicao">
            <Selecao id="aquisicao" name="aquisicao" defaultValue={item?.aquisicao ?? ""}>
              <option value="">Não informado</option>
              {opcoes(AQUISICOES).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </Grupo>

          <Grupo rotulo="Origem de fabricação" htmlFor="origemFabricacao">
            <Selecao
              id="origemFabricacao"
              name="origemFabricacao"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
            >
              <option value="">Não informado</option>
              {opcoes(ORIGENS).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </Grupo>

          <Grupo
            rotulo="Estoque mínimo"
            htmlFor="estoqueMinimo"
            ajuda="Abaixo disso o item aparece no painel como reposição."
          >
            <CampoNumero
              id="estoqueMinimo"
              name="estoqueMinimo"
              padrao={item ? String(item.estoqueMinimo) : "0"}
            />
          </Grupo>

          {/* Escolher, nunca digitar: lugar em texto livre virava o mesmo
              lugar com dois nomes, e af nao fechava filtro nem conferência.
              Lugar novo se cadastra em Configurações. */}
          <Grupo
            rotulo="Localização no estoque"
            htmlFor="localId"
            ajuda={
              locais.length === 0 ? (
                <>
                  Nenhum local cadastrado.{" "}
                  {/* Em outra aba de propósito: daqui, sair da página levaria
                      junto tudo que já foi digitado no item. */}
                  <Link
                    href="/configuracoes"
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-marca hover:underline"
                  >
                    Cadastre em Configurações
                  </Link>
                  , numa aba nova.
                </>
              ) : undefined
            }
          >
            <Selecao id="localId" name="localId" defaultValue={item?.localId ?? ""}>
              <option value="">Não definido</option>
              {locais
                .filter((l) => l.ativo || l.id === item?.localId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                    {l.ativo ? "" : " (inativo)"}
                  </option>
                ))}
            </Selecao>
          </Grupo>

          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-texto-suave">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={item?.ativo ?? true}
              className="size-4 accent-[var(--marca)]"
            />
            Item ativo
          </label>
        </CorpoCartao>
      </Cartao>

      {/* ------------------------------------------------ Fotos */}
      <Cartao>
        <CabecalhoCartao
          titulo="Fotos"
          descricao="Para reconhecer a peça na prateleira e para quem compra saber o que pedir."
        />
        <CorpoCartao>
          <FotosItem iniciais={item?.fotos ?? []} />
        </CorpoCartao>
      </Cartao>

      {/* ------------------------------------------------ Parâmetros 3D */}
      {mostra3d && (
        <Cartao>
          <CabecalhoCartao
            titulo="Parâmetros de impressão 3D"
            descricao="Aparece porque a origem de fabricação é impressão 3D."
          />
          <CorpoCartao>
            <Parametros3D valor={params3d} aoMudar={setParams3d} />
          </CorpoCartao>
        </Cartao>
      )}

      {/* ------------------------------------------------ Fornecedores */}
      <Cartao>
        <CabecalhoCartao
          titulo="Fornecedores deste item"
          descricao="É desta lista que a cotação de compra monta o comparativo de preços."
        />
        <CorpoCartao>
          <FornecedoresItem
            fornecedores={fornecedores}
            vinculos={vinculos}
            aoMudar={setVinculos}
          />
        </CorpoCartao>
      </Cartao>

      {/* ------------------------------------------------ Notas */}
      <Cartao>
        <CabecalhoCartao titulo="Observações e ficha técnica" />
        <CorpoCartao>
          <Abas
            abas={[
              {
                id: "obs",
                rotulo: "Observações",
                conteudo: (
                  <AreaTexto
                    name="observacoes"
                    defaultValue={item?.observacoes ?? ""}
                    rows={4}
                    placeholder="Notas de uso, cuidados, equivalências..."
                  />
                ),
              },
              {
                id: "ficha",
                rotulo: "Ficha técnica",
                conteudo: (
                  <AreaTexto
                    name="fichaTecnica"
                    defaultValue={item?.fichaTecnica ?? ""}
                    rows={4}
                    placeholder="Medidas, material, norma, torque..."
                  />
                ),
              },
            ]}
          />
        </CorpoCartao>
      </Cartao>

      {estado.erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-perigo-suave px-4 py-3 text-sm font-medium text-perigo"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {estado.erro}
        </p>
      )}

      {/* Barra fixa: em formulario longo, salvar nao pode exigir rolar ate o fim. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/90 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Botao type="button" variante="suave" onClick={() => router.push("/itens")}>
              Cancelar
            </Botao>
            {item && podeExcluir && (
              <BotaoExcluir
                oQue="item"
                nome={`${item.codigo} — ${item.descricao}`}
                ativo={item.ativo}
                dependencias={() => dependenciasItem(item.id)}
                excluir={() => excluirItem(item.id)}
                desativar={() => alternarAtivoItem(item.id, false)}
                aoConcluir={() => router.push("/itens")}
              />
            )}
          </div>

          <Botao type="submit" variante="salvar" tamanho="lg" disabled={salvando}>
            {salvando ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar item"}
          </Botao>
        </div>
      </div>
    </form>
  );
}

/** Converte os campos de texto do formulario nos tipos que a action espera. */
function paraEnvio(vinculos: VinculoFornecedor[]) {
  const n = (v: string) => {
    const x = Number(String(v).replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  };
  return vinculos
    .filter((v) => v.fornecedorId)
    .map((v) => ({
      fornecedorId: v.fornecedorId,
      skuFornecedor: v.skuFornecedor,
      linkItem: v.linkItem,
      preco: n(v.preco),
      prazoValor: n(v.prazoValor),
      prazoUnidade: v.prazoUnidade,
      qtdMinima: n(v.qtdMinima),
      observacoes: v.observacoes,
      principal: v.principal,
    }));
}
