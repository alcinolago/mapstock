import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FormularioCarro } from "@/components/frota/formulario-carro";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { listarVersoes, montagensParaCarro } from "@/db/consultas";
import { exigirEdicao } from "@/lib/auth";

export const metadata = { title: "Novo carro" };

export default async function NovoCarro() {
  await exigirEdicao();

  const [versoes, montagens] = await Promise.all([listarVersoes(), montagensParaCarro()]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/carros"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para carros
      </Link>

      <CabecalhoPagina titulo="Novo carro" descricao="Um veículo da frota, identificado pela placa." />

      <FormularioCarro versoes={versoes} montagens={montagens} podeExcluir={false} />
    </div>
  );
}
