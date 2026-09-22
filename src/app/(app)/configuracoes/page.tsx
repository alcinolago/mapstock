import { asc } from "drizzle-orm";

import {
  PainelAquisicoes,
  PainelClassificacoes,
  PainelLocais,
  PainelMateriais3d,
  PainelOrigens,
  PainelUnidades,
  type Classificacao,
} from "@/components/configuracoes/painel-listas";
import { PainelUsuarios } from "@/components/configuracoes/painel-usuarios";
import { Abas } from "@/components/ui/abas";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Cartao, CorpoCartao } from "@/components/ui/cartao";
import { db } from "@/db";
import {
  aquisicoes,
  classificacoes,
  locais,
  materiais3d,
  origensFabricacao,
  regrasClassificacao,
  unidades,
  usuarios,
} from "@/db/schema";
import { exigirAdmin } from "@/lib/auth";

export const metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  await exigirAdmin();

  const [
    listaClassificacoes,
    regras,
    listaUnidades,
    listaLocais,
    listaAquisicoes,
    listaOrigens,
    listaMateriais,
    listaUsuarios,
  ] = await Promise.all([
    db.select().from(classificacoes).orderBy(asc(classificacoes.ordem)),
    db.select().from(regrasClassificacao).orderBy(asc(regrasClassificacao.ordem)),
    db.select().from(unidades).orderBy(asc(unidades.sigla)),
    db.select().from(locais).orderBy(asc(locais.nome)),
    db.select().from(aquisicoes).orderBy(asc(aquisicoes.ordem)),
    db.select().from(origensFabricacao).orderBy(asc(origensFabricacao.ordem)),
    db.select().from(materiais3d).orderBy(asc(materiais3d.ordem)),
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
      <CabecalhoPagina titulo="Configurações" />

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
              { id: "unidades", rotulo: "Unidades", conteudo: <PainelUnidades lista={listaUnidades} /> },
              { id: "locais", rotulo: "Locais", conteudo: <PainelLocais lista={listaLocais} /> },
              {
                id: "aquisicoes",
                rotulo: "Aquisição",
                conteudo: <PainelAquisicoes lista={listaAquisicoes} />,
              },
              {
                id: "origens",
                rotulo: "Origens de fabricação",
                conteudo: (
                  <PainelOrigens
                    lista={listaOrigens.map((o) => ({ ...o, marca: o.abreParametros3d }))}
                  />
                ),
              },
              {
                id: "materiais3d",
                rotulo: "Materiais 3D",
                conteudo: <PainelMateriais3d lista={listaMateriais} />,
              },
            ]}
          />
        </CorpoCartao>
      </Cartao>
    </div>
  );
}
