import { cookies } from "next/headers";

import { Casca } from "@/components/layout/casca";
import { COOKIE_MENU } from "@/components/layout/preferencias";
import { exigirSessao } from "@/lib/auth";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const [sessao, biscoitos] = await Promise.all([exigirSessao(), cookies()]);
  const menuRecolhido = biscoitos.get(COOKIE_MENU)?.value === "1";

  return (
    <Casca sessao={sessao} menuRecolhido={menuRecolhido}>
      {children}
    </Casca>
  );
}
