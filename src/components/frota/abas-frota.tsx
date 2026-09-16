"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/carros", rotulo: "Frota", exato: true },
  { href: "/carros/versoes", rotulo: "Versões" },
];

export function AbasFrota() {
  const caminho = usePathname();

  return (
    <div className="rolagem-fina mb-5 flex gap-1 overflow-x-auto border-b border-borda">
      {ABAS.map((a) => {
        const ativa = a.exato ? caminho === a.href : caminho.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
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
