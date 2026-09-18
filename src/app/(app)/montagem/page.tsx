import { asc } from "drizzle-orm";

import {
  AbrirMontagem,
  PainelMontagem,
  type MontagemNaTela,
} from "@/components/montagem/painel-montagem";
import type { NoMontagem } from "@/components/montagem/arvore-montagem";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { db } from "@/db";
import { listarMoldes, listarMontagens, nosDaMontagem, type NoDaMontagem } from "@/db/consultas";
import { carros, montagens } from "@/db/schema";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Montagem" };

function emArvore(plana: NoDaMontagem[], paiId: string | null): NoMontagem[] {
  return plana
    .filter((n) => n.paiId === paiId)
    .map((n) => ({
      id: n.id,
      nome: n.nome,
      itemId: n.itemId,
      codigo: n.codigo,
      descricao: n.descricao,
      unidade: n.unidade,
      quantidade: n.quantidade,
      obrigatorio: n.obrigatorio,
      localMontagem: n.localMontagem,
      disponivel: n.disponivel,
      montadoEm: n.montadoEm,
      montadoPor: n.montadoPor,
      filhos: emArvore(plana, n.id),
    }));
}

export default async function PaginaMontagem() {
  const sessao = await exigirSessao();
  const podeEditar = sessao.papel !== "leitura";

  const [lista, moldes, frota, ocupados] = await Promise.all([
    listarMontagens({ incluirDesmontadas: true }),
    listarMoldes(),
    db.select({ id: carros.id, placa: carros.placa }).from(carros).orderBy(asc(carros.placa)),
    db.select({ carroId: montagens.carroId }).from(montagens),
  ]);

  const comCarro = new Set(ocupados.map((o) => o.carroId).filter(Boolean) as string[]);

  const comArvore: MontagemNaTela[] = await Promise.all(
    lista.map(async (m) => ({
      id: m.id,
      numero: m.numero,
      nome: m.nome,
      status: m.status,
      local: m.local,
      observacoes: m.observacoes,
      iniciadaEm: m.iniciadaEm,
      montadaEm: m.montadaEm,
      placa: m.placa,
      carroId: m.carroId,
      etapas: m.etapas,
      etapasFeitas: m.etapasFeitas,
      nos: emArvore(await nosDaMontagem(m.id), null),
    })),
  );

  const emAndamento = comArvore.filter((m) => m.status === "em_montagem").length;

  return (
    <div className="mx-auto max-w-[100rem]">
      <CabecalhoPagina
        titulo="Montagem"
        descricao={
          emAndamento > 0
            ? `${emAndamento} ${emAndamento === 1 ? "equipamento" : "equipamentos"} em montagem. Cada árvore é um equipamento.`
            : "Cada árvore aberta aqui é um equipamento. Montar uma divisão dá baixa nas peças dela."
        }
        acao={
          podeEditar ? (
            <AbrirMontagem
              moldes={moldes.filter((m) => m.ativo).map((m) => ({ id: m.id, nome: m.nome, nos: m.nos }))}
            />
          ) : undefined
        }
      />

      <PainelMontagem
        montagens={comArvore}
        carros={frota.map((c) => ({ id: c.id, placa: c.placa, ocupado: comCarro.has(c.id) }))}
        podeEditar={podeEditar}
      />
    </div>
  );
}
