import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { carregarItem, opcoesFormulario } from "@/components/itens/dados-formulario";
import { FormularioItem } from "@/components/itens/formulario-item";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Selo } from "@/components/ui/selo";
import { saldoDoItem } from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";
import { numero } from "@/lib/utils";

export const metadata = { title: "Editar item" };

export default async function EditarItem({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  const [item, opcoes, saldo] = await Promise.all([
    carregarItem(id),
    opcoesFormulario(),
    saldoDoItem(id),
  ]);

  if (!item) notFound();

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
        titulo={item.descricao}
        descricao={item.codigo}
        acao={
          <div className="flex items-center gap-2">
            <Selo tom="neutro">Físico {numero(saldo.fisico)}</Selo>
            {saldo.reservado > 0 && (
              <Selo tom="alerta">Reservado {numero(saldo.reservado)}</Selo>
            )}
            <Selo tom={saldo.disponivel > 0 ? "ok" : "perigo"}>
              Disponível {numero(saldo.disponivel)}
            </Selo>
          </div>
        }
      />

      <FormularioItem {...opcoes} item={item} podeExcluir={sessao.papel !== "leitura"} />
    </div>
  );
}
