import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FormularioCotacao } from "@/components/compras/formulario-cotacao";
import { db } from "@/db";
import { listarItensComSaldo } from "@/db/consultas";
import { itens } from "@/db/schema";
import { exigirEdicao } from "@/lib/auth";

export const metadata = { title: "Nova cotação" };

export default async function NovaCotacao() {
  await exigirEdicao();

  const [lista, equipamentos] = await Promise.all([
    listarItensComSaldo(),
    db
      .select({ id: itens.id, codigo: itens.codigo, descricao: itens.descricao })
      .from(itens)
      .where(and(eq(itens.nivel, 0), eq(itens.ativo, true)))
      .orderBy(itens.codigo),
  ]);

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
