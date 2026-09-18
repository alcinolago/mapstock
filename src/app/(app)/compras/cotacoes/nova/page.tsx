import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FormularioCotacao } from "@/components/compras/formulario-cotacao";
import { listarItensComSaldo, listarMoldes } from "@/db/consultas";
import { exigirEdicao } from "@/lib/auth";

export const metadata = { title: "Nova cotação" };

export default async function NovaCotacao() {
  await exigirEdicao();

  const [lista, moldes] = await Promise.all([listarItensComSaldo(), listarMoldes()]);

  /* Cotar "tudo que entra num equipamento" agora parte do molde: e nele que
     mora a receita desde que equipamento deixou de ser item de estoque. */
  const equipamentos = moldes
    .filter((m) => m.ativo && m.nos > 0)
    .map((m) => ({ id: m.id, codigo: m.nome, descricao: m.descricao ?? "" }));

  const qtdEmFalta = lista.filter(
    (i) => i.situacao === "falta" || i.situacao === "abaixo_minimo",
  ).length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/compras/cotacoes"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para cotações
      </Link>

      <FormularioCotacao equipamentos={equipamentos} qtdEmFalta={qtdEmFalta} />
    </div>
  );
}
