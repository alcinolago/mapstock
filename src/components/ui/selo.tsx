import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const selo = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tom: {
        neutro: "bg-superficie-2 text-texto-suave",
        marca: "bg-marca-suave text-marca",
        ok: "bg-ok-suave text-ok",
        alerta: "bg-alerta-suave text-alerta",
        perigo: "bg-perigo-suave text-perigo",
        info: "bg-info-suave text-info",
      },
    },
    defaultVariants: { tom: "neutro" },
  },
);

export function Selo({
  className,
  tom,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof selo>) {
  return <span className={cn(selo({ tom }), className)} {...props} />;
}

export type TomSelo = NonNullable<VariantProps<typeof selo>["tom"]>;
