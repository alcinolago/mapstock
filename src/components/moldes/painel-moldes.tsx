"use client";

import {
  AlertCircle,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  Printer,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SeletorItem, type ItemBusca } from "@/components/estoque/seletor-item";
import { Botao, botao } from "@/components/ui/botao";
import { AreaTexto, Entrada, Grupo } from "@/components/ui/campo";
import { CabecalhoCartao, Cartao } from "@/components/ui/cartao";
import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Modal } from "@/components/ui/modal";
import { Selo } from "@/components/ui/selo";
import { AdicionarNo, type OpcaoDivisao } from "./adicionar-no";
import { ArvoreMolde, type ComandoArvore, type NoMolde } from "./arvore-molde";
import { alternarMolde, excluirMolde, salvarMolde, type EstadoMolde } from "@/lib/acoes/moldes";
import { moeda, numero } from "@/lib/utils";

export type MoldeNaTela = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  emMontagem: number;
  custoTotal: number;
  /** Conjunto: o item do estoque que esta estrutura produz. Manual: nulo. */
  itemId: string | null;
  codigo: string | null;
  itemDescricao: string | null;
  unidade: string | null;
  emEstoque: number;
  nos: NoMolde[];
};

/**
 * A lista de estruturas de uma das duas telas.
 *
 * Em **Estrutura** ficam os equipamentos: o manual do que vai montado num
 * veículo inteiro. Não produz nada e não passa pela Montagem — serve para
 * quem está na bancada saber o que entra e onde cada coisa vai.
 *
 * Em **Conjuntos** ficam os que estão amarrados a um item do estoque. É o
 * domo, que tem quatro câmeras e um GPS dentro e vira uma unidade na
 * prateleira. Esses sim se montam, e é o que destrava a bancada — dá para
 * fazer seis domos na segunda porque chegaram as câmeras, sem esperar o
 * equipamento inteiro estar comprado.
 *
 * Já foram as duas metades de uma tela só, separadas por uma linha, e a
 * separação não bastou: quem abria Estrutura não sabia em qual das duas
 * listas estava, nem qual delas a Montagem enxergava. Telas diferentes no
 * menu respondem isso antes do primeiro clique.
 *
 * A divisão, nos dois casos, é só agrupamento de leitura.
 */
export function PainelMoldes({
  tipo,
  moldes,
  divisoes,
  itens,
  podeEditar,
}: {
  tipo: "equipamento" | "conjunto";
  moldes: MoldeNaTela[];
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  podeEditar: boolean;
}) {
  if (moldes.length === 0) {
    return (
      <Cartao>
        <p className="px-4 py-10 text-center text-sm text-texto-fraco">
          {tipo === "conjunto"
            ? "Nenhum conjunto ainda. É aqui que o domo vira um item montado a partir das peças."
            : "Nenhum equipamento documentado ainda."}
        </p>
      </Cartao>
    );
  }

  return (
    <div className="space-y-5">
      {moldes.map((m) => (
        <CartaoMolde
          key={m.id}
          molde={m}
          divisoes={divisoes}
          itens={itens}
          podeEditar={podeEditar}
        />
      ))}
    </div>
  );
}

function CartaoMolde({
  molde,
  divisoes,
  itens,
  podeEditar,
}: {
  molde: MoldeNaTela;
  divisoes: OpcaoDivisao[];
  itens: ItemBusca[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [comando, setComando] = useState<ComandoArvore>();

  const pecas = contar(molde.nos);
  /* Árvore só de primeiro nível não tem o que expandir. */
  const temNivel = molde.nos.some((n) => n.filhos.length > 0);
  const ehConjunto = Boolean(molde.itemId);

  return (
    <Cartao className="overflow-hidden">
      <CabecalhoCartao
        titulo={molde.nome}
        descricao={
          ehConjunto
            ? `${molde.codigo} — ${molde.itemDescricao}`
            : (molde.descricao ??
              `${pecas.divisoes} ${pecas.divisoes === 1 ? "divisão" : "divisões"} · ${pecas.pecas} ${pecas.pecas === 1 ? "peça" : "peças"}`)
        }
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {ehConjunto && (
              <Selo
                tom={molde.emEstoque > 0 ? "ok" : "neutro"}
                title="Unidades prontas no estoque"
              >
                {numero(molde.emEstoque)} {molde.unidade ?? "un"} em estoque
              </Selo>
            )}

            {molde.custoTotal > 0 && (
              <Selo tom="neutro" title="Soma das peças que entram numa unidade">
                {moeda(molde.custoTotal)}
              </Selo>
            )}

            {!molde.ativo && <Selo tom="alerta">inativo</Selo>}

            {molde.emMontagem > 0 && (
              <Selo tom="alerta" title="Unidades abertas na tela de Montagem">
                {molde.emMontagem} em montagem
              </Selo>
            )}

            {temNivel && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={() =>
                  setComando((c) => ({ aberto: !c?.aberto, vez: (c?.vez ?? 0) + 1 }))
                }
              >
                {comando?.aberto ? (
                  <ChevronsDownUp className="size-3.5" />
                ) : (
                  <ChevronsUpDown className="size-3.5" />
                )}
                {comando?.aberto ? "Recolher tudo" : "Expandir tudo"}
              </Botao>
            )}

            {/* Link comum, como o PDF do pedido: o navegador abre a folha
                numa aba e a impressão sai pelo leitor de PDF dele. Leitura
                imprime também — quem está na bancada nem sempre edita. */}
            {molde.nos.length > 0 && (
              <a
                href={`/api/exportar/estrutura/${molde.id}?visualizar=1`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir a estrutura inteira em PDF para imprimir ou salvar"
                className={botao({ variante: "fantasma", tamanho: "sm" })}
              >
                <Printer className="size-3.5" />
                Imprimir
              </a>
            )}

            {podeEditar && (
              <>
                {/* Cotar um conjunto é cotar as peças dele: o próprio item nunca é
                    comprado, ele nasce da montagem. */}
                {molde.nos.length > 0 && (
                  <Link
                    href={`/compras/cotacoes/nova?estrutura=${molde.id}`}
                    title="Cotar as peças desta estrutura"
                    aria-label={`Cotar as peças de ${molde.nome}`}
                    className={botao({ variante: "fantasma", tamanho: "sm" })}
                  >
                    <ShoppingCart className="size-3.5" />
                  </Link>
                )}

                <AdicionarNo
                  moldeId={molde.id}
                  paiId={null}
                  paiNome={molde.nome}
                  divisoes={divisoes}
                  itens={itens}
                />

                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  disabled={pendente}
                  title={molde.ativo ? "Desativar" : "Reativar"}
                  onClick={() =>
                    iniciar(async () => {
                      await alternarMolde(molde.id);
                      router.refresh();
                    })
                  }
                >
                  {molde.ativo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Botao>

                <BotaoConfirmar
                  rotulo={`Excluir ${molde.nome}`}
                  Icone={Trash2}
                  tamanho="sm"
                  somenteIcone
                  iconeClassName="size-3.5 text-perigo"
                  dica="Excluir estrutura"
                  titulo="Excluir estrutura"
                  descricao={molde.nome}
                  rotuloConfirmar="Excluir"
                  aoConfirmar={async () => {
                    const r = await excluirMolde(molde.id);
                    if (r.erro) return r;
                    router.refresh();
                  }}
                >
                  <p>
                    Sai a estrutura inteira, com todas as divisões e peças dela. Nada disso mexe
                    no estoque{ehConjunto ? ", nem no item que ela produz" : ""}. Montagens já abertas
                    guardam a cópia delas e continuam como estão.
                  </p>
                </BotaoConfirmar>
              </>
            )}
          </div>
        }
      />
      <ArvoreMolde
        moldeId={molde.id}
        nos={molde.nos}
        divisoes={divisoes}
        itens={itens}
        podeEditar={podeEditar}
        comando={comando}
      />
    </Cartao>
  );
}

function contar(nos: NoMolde[]): { divisoes: number; pecas: number } {
  return nos.reduce(
    (total, no) => {
      const dentro = contar(no.filhos);
      return {
        divisoes: total.divisoes + (no.itemId ? 0 : 1) + dentro.divisoes,
        pecas: total.pecas + (no.itemId ? 1 : 0) + dentro.pecas,
      };
    },
    { divisoes: 0, pecas: 0 },
  );
}

/**
 * Criar uma estrutura. O tipo não é um campo do formulário: cada tela tem o
 * seu botão, porque a escolha é sobre em qual das duas listas aquilo vai
 * morar — e essa pergunta se responde clicando no lugar certo, não num
 * select.
 */
export function NovoMolde({
  tipo,
  itensSemEstrutura = [],
}: {
  tipo: "equipamento" | "conjunto";
  itensSemEstrutura?: ItemBusca[];
}) {
  const ehConjunto = tipo === "conjunto";
  const [aberto, setAberto] = useState(false);
  const [chave, setChave] = useState(0);
  const [itemId, setItemId] = useState<string | null>(null);
  const [tratado, setTratado] = useState<EstadoMolde | null>(null);
  const [estado, acao, enviando] = useActionState<EstadoMolde, FormData>(salvarMolde, {});

  if (estado.ok && estado !== tratado) {
    setTratado(estado);
    setAberto(false);
    setItemId(null);
    setChave((k) => k + 1);
  }

  const idFormulario = `novo-molde-${tipo}`;

  return (
    <>
      <Botao variante={ehConjunto ? "primario" : "contorno"} onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        {ehConjunto ? "Novo conjunto" : "Nova estrutura"}
      </Botao>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={ehConjunto ? "Novo conjunto" : "Nova estrutura"}
        descricao={
          ehConjunto
            ? "Um item do estoque que é montado a partir de outros. Montar consome as peças e coloca uma unidade dele na prateleira."
            : "O manual de um equipamento completo. Não vira item, não tem saldo e não passa pela montagem."
        }
        centralizado
        rodape={
          <>
            <Botao variante="suave" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao
              type="submit"
              form={idFormulario}
              disabled={enviando || (ehConjunto && !itemId)}
            >
              {enviando ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Criar
            </Botao>
          </>
        }
      >
        <form id={idFormulario} action={acao} key={chave} className="space-y-4">
          {ehConjunto && <input type="hidden" name="itemId" value={itemId ?? ""} />}

          {ehConjunto && (
            <Grupo
              rotulo="Item do estoque"
              obrigatorio
              ajuda="O item que sai pronto. Ele já tem que estar cadastrado, e só aparecem aqui os que ainda não têm estrutura."
            >
              <SeletorItem
                itens={itensSemEstrutura}
                valor={itemId ?? undefined}
                aoEscolher={setItemId}
                nome="itemIdVisual"
                placeholder="Buscar item por código ou descrição..."
              />
            </Grupo>
          )}

          <Grupo rotulo="Nome" obrigatorio htmlFor={`${idFormulario}-nome`}>
            <Entrada
              id={`${idFormulario}-nome`}
              name="nome"
              placeholder={ehConjunto ? "Ex.: Domo" : "Ex.: Equipamento de inspeção XYZ"}
              required
              autoFocus={!ehConjunto}
            />
          </Grupo>

          <Grupo rotulo="Descrição" htmlFor={`${idFormulario}-descricao`}>
            <AreaTexto
              id={`${idFormulario}-descricao`}
              name="descricao"
              placeholder="O que é, para que serve, particularidades da montagem"
            />
          </Grupo>

          {estado.erro && (
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
