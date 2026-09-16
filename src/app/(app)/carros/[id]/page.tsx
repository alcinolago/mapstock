import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FormularioCarro } from "@/components/frota/formulario-carro";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { carroPorId, listarVersoes, montagensParaCarro } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Carro" };

export default async function EditarCarro({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const [carro, versoes, montagens] = await Promise.all([
    carroPorId(id),
    listarVersoes(),
    montagensParaCarro(id),
  ]);

  if (!carro) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/carros"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para carros
      </Link>

      <CabecalhoPagina titulo={carro.placa} descricao={`${carro.fabricante} ${carro.modelo}`} />

      <FormularioCarro
        carro={carro}
        versoes={versoes}
        montagens={montagens}
        podeExcluir={sessao.papel !== "leitura"}
      />
    </div>
  );
}
