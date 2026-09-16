import { AbasFrota } from "@/components/frota/abas-frota";
import { PainelVersoes } from "@/components/frota/painel-versoes";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { listarVersoes } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Versões" };

export default async function PaginaVersoes() {
  const sessao = await exigirSessao();
  const versoes = await listarVersoes();

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina
        titulo="Carros"
        descricao="Versões do sistema que roda no PC do carro e do app que roda no tablet."
      />

      <AbasFrota />

      <PainelVersoes versoes={versoes} podeEditar={sessao.papel !== "leitura"} />
    </div>
  );
}
