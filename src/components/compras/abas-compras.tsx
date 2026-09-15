"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/compras/cotacoes", rotulo: "Cotações" },
  { href: "/compras/pedidos", rotulo: "Pedidos" },
];

export function AbasCompras() {
  const caminho = usePathname();

  return (
    <div className="mb-5 flex gap-1 border-b border-borda">
      {ABAS.map((a) => {
        const ativa = caminho.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              ativa
                ? "border-marca text-marca"
                : "border-transparent text-texto-fraco hover:text-texto",
            )}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
