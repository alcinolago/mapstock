import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export const moeda = (v: number | null | undefined) => MOEDA.format(v ?? 0);
export const numero = (v: number | null | undefined) => NUMERO.format(v ?? 0);
export const dataHora = (v: Date | string | null | undefined) =>
  v ? DATA_HORA.format(new Date(v)) : "—";
export const data = (v: Date | string | null | undefined) =>
  v ? DATA.format(new Date(v)) : "—";

/** Aceita "12,5" e "12.5" — no teclado brasileiro a virgula vem primeiro. */
export function paraNumero(valor: unknown, padrao = 0): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : padrao;
  if (typeof valor !== "string") return padrao;
  const limpo = valor.trim().replace(/\s/g, "").replace(",", ".");
  if (limpo === "") return padrao;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : padrao;
}
