import { asc } from "drizzle-orm";

import {
  PainelClassificacoes,
  PainelLocais,
  PainelNiveis,
  PainelUnidades,
  type Classificacao,
} from "@/components/configuracoes/painel-listas";
import { PainelUsuarios } from "@/components/configuracoes/painel-usuarios";
import { Abas } from "@/components/ui/abas";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao, CorpoCartao } from "@/components/ui/cartao";
import { db } from "@/db";
import { classificacoes, locais, niveis, regrasClassificacao, unidades, usuarios } from "@/db/schema";
import { exigirAdmin } from "@/lib/auth";

export const metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  await exigirAdmin();

  const [listaNiveis, listaClassificacoes, regras, listaUnidades, listaLocais, listaUsuarios] =
    await Promise.all([
      db.select().from(niveis).orderBy(asc(niveis.num)),
      db.select().from(classificacoes).orderBy(asc(classificacoes.ordem)),
      db.select().from(regrasClassificacao).orderBy(asc(regrasClassificacao.ordem)),
      db.select().from(unidades).orderBy(asc(unidades.sigla)),
      db.select().from(locais).orderBy(asc(locais.nome)),
      db
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          papel: usuarios.papel,
          ativo: usuarios.ativo,
        })
        .from(usuarios)
        .orderBy(asc(usuarios.nome)),
    ]);

  const comRegras: Classificacao[] = listaClassificacoes.map((c) => ({
    id: c.id,
    nome: c.nome,
    prefixoCodigo: c.prefixoCodigo,
    ativo: c.ativo,
    regras: regras
      .filter((r) => r.classificacaoId === c.id)
      .map((r) => ({ id: r.id, palavraChave: r.palavraChave })),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="As listas que alimentam o cadastro de itens e quem tem acesso ao sistema."
      />

      <Cartao>
        <CorpoCartao>
          <Abas
            abas={[
              { id: "usuarios", rotulo: "Usuários", conteudo: <PainelUsuarios usuarios={listaUsuarios} /> },
              {
                id: "classificacoes",
                rotulo: "Classificações",
                conteudo: <PainelClassificacoes lista={comRegras} />,
              },
              { id: "niveis", rotulo: "Níveis", conteudo: <PainelNiveis niveis={listaNiveis} /> },
              { id: "unidades", rotulo: "Unidades", conteudo: <PainelUnidades lista={listaUnidades} /> },
              { id: "locais", rotulo: "Locais", conteudo: <PainelLocais lista={listaLocais} /> },
            ]}
          />
        </CorpoCartao>
      </Cartao>
    </div>
  );
}
