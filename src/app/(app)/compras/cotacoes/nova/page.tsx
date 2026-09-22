import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FormularioCotacao } from "@/components/compras/formulario-cotacao";
import { listarItensComSaldo, listarMoldes } from "@/db/consultas";
import { exigirEdicao } from "@/lib/auth";

export const metadata = { title: "Nova cotação" };

export default async function NovaCotacao({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirEdicao();

  const p = await searchParams;
  const [lista, moldes] = await Promise.all([listarItensComSaldo(), listarMoldes()]);

  /* Cotar "tudo que entra em X" parte da estrutura — tanto do manual de um
     equipamento quanto do kit de um item. No kit, as pecas cotadas sao as que
     compoem o item: o domo em si nunca e comprado, ele nasce da montagem. */
  const estruturas = moldes
    .filter((m) => m.ativo && m.nos > 0)
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      detalhe: m.itemId ? `${m.codigo}` : "equipamento",
    }));

  const escolhida = estruturas.find((e) => e.id === p.estrutura)?.id;

  const qtdEmFalta = lista.filter(
    (i) => i.situacao === "falta" || i.situacao === "abaixo_minimo",
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/compras/cotacoes"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para cotações
      </Link>

      <FormularioCotacao estruturas={estruturas} inicial={escolhida} qtdEmFalta={qtdEmFalta} />
    </div>
  );
}
