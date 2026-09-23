import { NovoMolde, PainelMoldes } from "@/components/moldes/painel-moldes";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { exigirSessao } from "@/lib/auth";
import { carregarTelaEstrutura } from "@/lib/estrutura";

export const metadata = { title: "Estrutura" };

/**
 * Os equipamentos completos: o manual de bancada, que não vira item e não
 * passa pela Montagem. Os conjuntos moram na tela deles.
 */
export default async function PaginaEstrutura() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const { estruturas, divisoes, itens } = await carregarTelaEstrutura();

  return (
    <>
      <CabecalhoPagina
        titulo="Estrutura"
        acao={podeEditar ? <NovoMolde tipo="equipamento" /> : undefined}
      />

      <PainelMoldes
        tipo="equipamento"
        moldes={estruturas.filter((m) => !m.itemId)}
        divisoes={divisoes}
        itens={itens}
        podeEditar={podeEditar}
      />
    </>
  );
}
