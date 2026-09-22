import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PainelMontagem, type MontagemNaTela } from "@/components/montagem/painel-montagem";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Paginacao } from "@/components/ui/paginacao";
import {
  contarMontagens,
  listarMontagens,
  nosDaMontagem,
  primeiraMontagem,
} from "@/db/consultas";
import { exigirSessao } from "@/lib/auth";
import { lerPaginacao, paginaValida } from "@/lib/paginacao";
import { dataValida, mesesAte } from "@/lib/periodo";
import { emArvore, porItem } from "../arvore";
import { FiltrosHistoricoMontagem } from "./filtros";

export const metadata = { title: "Histórico de montagem" };

/**
 * O que já foi montado.
 *
 * Tela à parte da Montagem porque unidade montada não tem mais ação nenhuma:
 * ela virou movimento no estoque e não volta atrás. Misturada com as abertas,
 * ela só empurrava para baixo o que ainda tem trabalho — e a tela crescia sem
 * parar, uma linha por domo feito desde sempre.
 */
export default async function PaginaHistoricoMontagem({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirSessao();
  const p = await searchParams;

  const de = dataValida(p.de);
  const ate = dataValida(p.ate);
  const filtros = { status: "montada" as const, de, ate };

  const total = await contarMontagens(filtros);
  const pedida = lerPaginacao(p.pagina, p.porPagina);
  const pagina = paginaValida(pedida.pagina, total, pedida.porPagina);

  const [lista, primeira] = await Promise.all([
    listarMontagens({ ...filtros, porPagina: pedida.porPagina, pular: (pagina - 1) * pedida.porPagina }),
    primeiraMontagem(),
  ]);

  const comArvore: MontagemNaTela[] = await Promise.all(
    lista.map(async (m) => {
      const plana = await nosDaMontagem(m.id);
      return {
        id: m.id,
        numero: m.numero,
        nome: m.nome,
        item: `${m.codigo} — ${m.itemDescricao}`,
        status: m.status,
        local: m.local,
        observacoes: m.observacoes,
        iniciadaEm: m.iniciadaEm,
        montadaEm: m.montadaEm,
        montadaPor: m.montadaPor,
        /* Saldo de hoje não diz nada sobre o que foi consumido naquele dia. */
        faltando: 0,
        nos: emArvore(plana, null, porItem(plana)),
      };
    }),
  );

  return (
    <>
      <Link
        href="/montagem"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-texto-fraco transition-colors hover:text-marca"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para montagem
      </Link>

      <CabecalhoPagina titulo="Histórico de montagem" />

      <FiltrosHistoricoMontagem meses={mesesAte(primeira)} />

      <PainelMontagem
        montagens={comArvore}
        podeEditar={false}
        vazio={
          de || ate
            ? "Nenhuma montagem concluída neste período."
            : "Nada montado ainda. O que você montar aparece aqui."
        }
      />

      {total > 0 && (
        <div className="mt-4">
          <Paginacao
            pagina={pagina}
            porPagina={pedida.porPagina}
            total={total}
            oQue="montagens"
          />
        </div>
      )}
    </>
  );
}
