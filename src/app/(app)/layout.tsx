import { Casca } from "@/components/layout/casca";
import { exigirSessao } from "@/lib/auth";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  return <Casca sessao={sessao}>{children}</Casca>;
}
