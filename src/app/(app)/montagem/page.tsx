import { History } from "lucide-react";
import Link from "next/link";

import {
  NovaMontagem,
  PainelMontagem,
  type MontagemNaTela,
} from "@/components/montagem/painel-montagem";
import { botao } from "@/components/ui/botao";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { listarMoldes, listarMontagens, nosDaMontagem } from "@/db/consultas";
import { emArvore, porItem } from "./arvore";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Montagem" };

export default async function PaginaMontagem() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  /* Só o que está aberto: montada não tem mais ação nenhuma e vai para o
     histórico, senão esta tela cresce para sempre. */
  const [lista, moldes] = await Promise.all([
    listarMontagens({ status: "em_montagem" }),
    listarMoldes(),
  ]);

  const comArvore: MontagemNaTela[] = await Promise.all(
    lista.map(async (m) => {
      const plana = await nosDaMontagem(m.id);
      const necessario = porItem(plana);

      /* O saldo de cada peca ja veio na consulta da arvore; falta so compara
         com o total que esta montagem consome. */
      const saldo = new Map(plana.filter((n) => n.itemId).map((n) => [n.itemId!, n.disponivel]));
      const faltando = [...necessario.entries()].filter(
        ([itemId, q]) => (saldo.get(itemId) ?? 0) < q,
      ).length;

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
        faltando,
        nos: emArvore(plana, null, necessario),
      };
    }),
  );

  /* So conjunto se monta: o manual do equipamento completo nao produz item nenhum
     e nao aparece aqui. */
  const conjuntos = moldes
    .filter((m) => m.itemId && m.ativo && m.nos > 0)
    .map((m) => ({ id: m.id, nome: m.nome, item: `${m.codigo} — ${m.itemDescricao}` }));

  return (
    <>
      <CabecalhoPagina
        titulo="Montagem"
        acao={
          <div className="flex items-center gap-2">
            <Link
              href="/montagem/historico"
              className={botao({ variante: "contorno", tamanho: "md" })}
            >
              <History className="size-4" />
              Histórico
            </Link>
            {podeEditar && <NovaMontagem conjuntos={conjuntos} />}
          </div>
        }
      />

      <PainelMontagem
        montagens={comArvore}
        podeEditar={podeEditar}
        vazio={
          <>
            Nada em montagem. Escolha um item em{" "}
            <strong className="font-semibold text-texto-suave">Nova montagem</strong> — cada uma
            vale por uma unidade.
          </>
        }
      />
    </>
  );
}
