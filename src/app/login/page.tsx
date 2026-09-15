import type { Metadata } from "next";

import { PaginaLogin } from "./pagina-login";

export const metadata: Metadata = { title: "Entrar — MapStock" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { destino } = await searchParams;
  return <PaginaLogin destino={destino} />;
}
