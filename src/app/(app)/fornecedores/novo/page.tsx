import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FormularioFornecedor } from "@/components/fornecedores/formulario-fornecedor";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { exigirEdicao } from "@/lib/auth";

export const metadata = { title: "Novo fornecedor" };

export default async function NovoFornecedor() {
  await exigirEdicao();
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/fornecedores"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para fornecedores
      </Link>
      <CabecalhoPagina titulo="Novo fornecedor" />
      <FormularioFornecedor podeExcluir={false} />
    </div>
  );
}
