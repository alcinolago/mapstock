import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { opcoesFormulario } from "@/components/itens/dados-formulario";
import { FormularioItem } from "@/components/itens/formulario-item";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { exigirEdicao } from "@/lib/auth";

export const metadata = { title: "Novo item" };

export default async function NovoItem() {
  await exigirEdicao();
  const opcoes = await opcoesFormulario();

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/itens"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para itens
      </Link>

      <CabecalhoPagina
        titulo="Novo item"
        descricao="Comece pela descrição — a classificação e o código se preenchem sozinhos."
      />

      <FormularioItem {...opcoes} podeExcluir={false} />
    </div>
  );
}
