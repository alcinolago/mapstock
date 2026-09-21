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
import { voltarPara } from "@/lib/voltar";

export const metadata = { title: "Editar item" };

export default async function EditarItem({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;

  /* De onde a pessoa veio: quem abriu este cadastro de dentro de uma cotacao
     precisa voltar para ela, e nao para a lista de itens. */
  const volta = voltarPara((await searchParams).volta);

  const [item, opcoes, saldo] = await Promise.all([
    carregarItem(id),
    opcoesFormulario(),
    saldoDoItem(id),
  ]);

  if (!item) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={volta.href}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        {volta.rotulo}
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

      <FormularioItem
        {...opcoes}
        item={item}
        podeExcluir={sessao.papel !== "leitura"}
        voltarPara={volta.href}
      />
    </div>
  );
}
