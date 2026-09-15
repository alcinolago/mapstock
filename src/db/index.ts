import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;

if (!url) {
  /* Este erro aparece durante o build, nao em tempo de execucao, entao a
     mensagem precisa dizer onde configurar em cada ambiente — quem topa com
     ele na Vercel nao tem um .env.local para editar. */
  throw new Error(
    "DATABASE_URL não definida.\n" +
      "  Local:  copie .env.example para .env.local e cole a connection string do Neon.\n" +
      "  Vercel: Settings → Environment Variables, marcando Production, Preview e Development.",
  );
}

export const db = drizzle(neon(url), { schema });
export { schema };
