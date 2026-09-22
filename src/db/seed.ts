/**
 * Popula o banco com a configuracao que no desktop vivia fixa no codigo:
 * papeis, classificacoes com seus prefixos de codigo, unidades e as regras
 * de classificacao automatica. Tambem cria o usuario administrador.
 *
 * E idempotente — pode rodar quantas vezes precisar.
 *
 *   npm run db:seed
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "./index";
import {
  aquisicoes,
  classificacoes,
  materiais3d,
  origensFabricacao,
  regrasClassificacao,
  unidades,
  usuarios,
} from "./schema";

/* Nome, prefixo do codigo e as palavras que disparam a classificacao
   automatica. Vem da lista CLASSIFICATIONS e das funcoes classify() e
   code_suggestion() do MPZ-ERP-V35.pyw. A ordem importa: na classificacao
   automatica, a primeira regra que casar vence. */
const CLASSIFICACOES: { nome: string; prefixo: string; palavras: string[] }[] = [
  { nome: "Consumível", prefixo: "CNS", palavras: ["FILAMENTO", "ETIQUETA", "LACRE", "ADESIVO", "COLA", "RESINA"] },
  { nome: "Fixação", prefixo: "FIX", palavras: ["PARAFUSO", "PORCA", "ARRUELA", "REBITE", "INSERTO"] },
  { nome: "Sensor", prefixo: "SEN", palavras: ["CAMERA", "LIDAR", "GPS", "IMU", "SENSOR", "RADAR"] },
  { nome: "Elétrica", prefixo: "ELE", palavras: ["FONTE", "INVERSOR", "DISJUNTOR", "RELE", "FUSIVEL", "BATERIA"] },
  { nome: "Eletrônica/Automação", prefixo: "AUT", palavras: ["JETSON", "ESP32", "RASPBERRY", "PLACA", "DRIVER"] },
  { nome: "Cabeamento", prefixo: "CBL", palavras: ["CABO", "CHICOTE", "MALHA"] },
  { nome: "Impressão 3D", prefixo: "IMP", palavras: ["BICO", "HOTEND", "PEI", "PTFE", "EXTRUSOR"] },
  { nome: "Mecânica fabricada", prefixo: "MEC", palavras: ["SUPORTE", "BASE", "ADAPTADOR"] },
  { nome: "Carenagem/Domo", prefixo: "DOM", palavras: ["DOMO", "CARENAGEM", "TAMPA"] },
  { nome: "Estrutural", prefixo: "EST", palavras: ["PERFIL", "CHAPA", "TUBO", "DOBRADICA"] },
  { nome: "Conexão elétrica", prefixo: "CON", palavras: [] },
];

const UNIDADES = [
  { sigla: "un", nome: "Unidade" },
  { sigla: "kg", nome: "Quilograma" },
  { sigla: "g", nome: "Grama" },
  { sigla: "m", nome: "Metro" },
  { sigla: "rolo", nome: "Rolo" },
  { sigla: "caixa", nome: "Caixa" },
  { sigla: "conj.", nome: "Conjunto" },
];

/* Estas tres eram enums no schema. Viraram cadastro, e o que sobrou aqui e
   so o ponto de partida: quem usa acrescenta e desativa em Configuracoes. */
const AQUISICOES = [
  "Compra nacional",
  "Compra importada",
  "Fabricação interna",
  "Sob encomenda",
];

const ORIGENS: { nome: string; abre3d?: boolean }[] = [
  { nome: "Interna — Impressão 3D", abre3d: true },
  { nome: "Interna — Usinagem" },
  { nome: "Interna — Montagem" },
  { nome: "Terceiro — Impressão 3D", abre3d: true },
  { nome: "Terceiro — Usinagem" },
  { nome: "Terceiro — Corte/Dobra" },
  { nome: "Compra pronta nacional" },
  { nome: "Compra importada" },
];

const MATERIAIS_3D = [
  "ABS", "PLA", "PETG", "TPU", "TPE", "ASA", "Nylon", "PA", "PA6", "PA12",
  "PA-GF", "PA-CF", "PC", "PC-ABS", "POM", "PP", "HIPS", "PVA", "BVOH", "PET",
  "PEEK", "PEI", "ULTEM", "Resina standard", "Resina tough", "Resina flexível",
  "Resina lavável em água", "Outro",
];

async function main() {
  console.log("Populando o banco...\n");


  await db
    .insert(classificacoes)
    .values(
      CLASSIFICACOES.map((c, ordem) => ({
        nome: c.nome,
        prefixoCodigo: c.prefixo,
        ordem,
      })),
    )
    .onConflictDoNothing();
  console.log(`  classificações: ${CLASSIFICACOES.length}`);

  await db.insert(unidades).values(UNIDADES).onConflictDoNothing();
  console.log(`  unidades: ${UNIDADES.length}`);

  await db
    .insert(aquisicoes)
    .values(AQUISICOES.map((nome, ordem) => ({ nome, ordem })))
    .onConflictDoNothing();
  console.log(`  tipos de aquisição: ${AQUISICOES.length}`);

  await db
    .insert(origensFabricacao)
    .values(
      ORIGENS.map((o, ordem) => ({
        nome: o.nome,
        abreParametros3d: Boolean(o.abre3d),
        ordem,
      })),
    )
    .onConflictDoNothing();
  console.log(`  origens de fabricação: ${ORIGENS.length}`);

  await db
    .insert(materiais3d)
    .values(MATERIAIS_3D.map((nome, ordem) => ({ nome, ordem })))
    .onConflictDoNothing();
  console.log(`  materiais de impressão 3D: ${MATERIAIS_3D.length}`);

  /* As regras precisam do id da classificacao, entao vem depois. */
  const salvas = await db.select().from(classificacoes);
  const porNome = new Map(salvas.map((c) => [c.nome, c.id]));

  const regras = CLASSIFICACOES.flatMap((c, grupo) =>
    c.palavras.map((palavra, i) => ({
      classificacaoId: porNome.get(c.nome)!,
      palavraChave: palavra,
      ordem: grupo * 100 + i,
    })),
  );
  await db.insert(regrasClassificacao).values(regras).onConflictDoNothing();
  console.log(`  regras de classificação: ${regras.length}`);

  const email = process.env.ADMIN_EMAIL ?? "alcino.lago@mapzer.com.br";
  const senha = process.env.ADMIN_SENHA ?? "mapzer123";
  const existente = await db.select().from(usuarios).where(eq(usuarios.email, email));

  if (existente.length === 0) {
    await db.insert(usuarios).values({
      nome: process.env.ADMIN_NOME ?? "Alcino Lago",
      email,
      senhaHash: await bcrypt.hash(senha, 10),
      papel: "admin",
    });
    console.log(`\n  administrador criado`);
    console.log(`     e-mail: ${email}`);
    console.log(`     senha:  ${senha}   <- troque no primeiro acesso`);
  } else {
    console.log(`\n  administrador já existe: ${email}`);
  }

  console.log("\nPronto.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
