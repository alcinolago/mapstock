import { NovoMolde, PainelMoldes } from "@/components/moldes/painel-moldes";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { exigirSessao } from "@/lib/auth";
import { carregarTelaEstrutura } from "@/lib/estrutura";

export const metadata = { title: "Conjuntos" };

/**
 * As receitas dos itens do estoque que se montam a partir de outros — o domo.
 * É desta lista, e só dela, que a Montagem escolhe o que abrir.
 */
export default async function PaginaConjuntos() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const { estruturas, divisoes, itens, itensSemEstrutura } = await carregarTelaEstrutura();

  return (
    <>
      <CabecalhoPagina
        titulo="Conjuntos"
        acao={
          podeEditar ? (
            <NovoMolde tipo="conjunto" itensSemEstrutura={itensSemEstrutura} />
          ) : undefined
        }
      />

      <PainelMoldes
        tipo="conjunto"
        moldes={estruturas.filter((m) => m.itemId)}
        divisoes={divisoes}
        itens={itens}
        podeEditar={podeEditar}
      />
    </>
  );
}
