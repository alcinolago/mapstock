"use client";

import { Car, PackageOpen, Warehouse } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BotaoConfirmar } from "@/components/ui/confirmar";
import { Selo, type TomSelo } from "@/components/ui/selo";
import type { Montagem } from "@/db/consultas";
import { desmontarMontagem } from "@/lib/acoes/montagens";
import { STATUS_MONTAGEM, type StatusMontagem } from "@/lib/labels";
import { data } from "@/lib/utils";

const TOM: Record<StatusMontagem, TomSelo> = {
  montada: "ok",
  instalada: "marca",
  desmontada: "neutro",
};

/**
 * As unidades que existem de verdade, uma a uma — a outra metade da tela de
 * estrutura. Em cima, a receita; aqui, o que foi montado a partir dela e
 * onde cada unidade está.
 */
export function Montagens({
  montagens,
  podeEditar,
}: {
  montagens: Montagem[];
  podeEditar: boolean;
}) {
  const router = useRouter();

  async function desmontar(m: Montagem) {
    const r = await desmontarMontagem(m.id);
    if (r.erro) return r;
    router.refresh();
  }

  if (montagens.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-texto-fraco">
        Nenhuma estrutura montada ainda. Use o botão <strong>Montar</strong> na árvore acima: ele
        confere o estoque, consome as peças e deixa o equipamento pronto para uso.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-borda">
      {montagens.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
          <span className="codigo shrink-0 text-xs font-semibold text-texto-suave">
            {m.numero}
          </span>

          <Link
            href={`/itens/${m.itemId}`}
            className="codigo shrink-0 text-xs font-semibold text-marca hover:underline"
          >
            {m.codigo}
          </Link>

          <span className="min-w-0 flex-1 truncate text-sm text-texto">{m.descricao}</span>

          {m.placa ? (
            <Link
              href="/carros"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-marca hover:underline"
            >
              <Car className="size-3.5" />
              {m.placa}
            </Link>
          ) : m.local ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-texto-fraco">
              <Warehouse className="size-3.5" />
              {m.local}
            </span>
          ) : null}

          <Selo tom={TOM[m.status]}>{STATUS_MONTAGEM[m.status]}</Selo>

          <span className="shrink-0 text-xs whitespace-nowrap text-texto-fraco">
            {data(m.montadaEm)}
            {m.montadaPor && ` · ${m.montadaPor}`}
          </span>

          {podeEditar && m.status === "montada" && (
            <BotaoConfirmar
              rotulo="Desmontar"
              Icone={PackageOpen}
              tamanho="sm"
              tom="alerta"
              iconeClassName="size-3.5"
              dica="Desmontar e devolver as peças ao estoque"
              titulo="Desmontar unidade"
              descricao={`${m.numero} — ${m.codigo}`}
              rotuloConfirmar="Desmontar"
              aoConfirmar={() => desmontar(m)}
            >
              <p>
                As peças que foram consumidas voltam para o estoque e o equipamento sai do
                saldo — os dois lados viram movimentação, como na montagem.
              </p>
            </BotaoConfirmar>
          )}
        </li>
      ))}
    </ul>
  );
}
