"use client";

import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { MATERIAIS_3D } from "@/lib/labels";

export type Params3D = {
  material: string;
  tempBico: string;
  tempMesa: string;
  preenchimento: string;
  alturaCamada: string;
  diametroBico: string;
  pesoEstimado: string;
  tempoEstimado: string;
};

/* Mesmos padroes que o formulario do desktop ja trazia preenchidos. */
export const PARAMS_3D_PADRAO: Params3D = {
  material: "ABS",
  tempBico: "245",
  tempMesa: "100",
  preenchimento: "20%",
  alturaCamada: "0.20",
  diametroBico: "0.40",
  pesoEstimado: "",
  tempoEstimado: "",
};

export function Parametros3D({
  valor,
  aoMudar,
}: {
  valor: Params3D;
  aoMudar: (v: Params3D) => void;
}) {
  const definir = (campo: keyof Params3D) => (v: string) => aoMudar({ ...valor, [campo]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Grupo rotulo="Material">
        <Selecao
          value={valor.material}
          onChange={(e) => definir("material")(e.target.value)}
        >
          {MATERIAIS_3D.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Selecao>
      </Grupo>
      <Grupo rotulo="Temp. bico (°C)">
        <Entrada
          inputMode="decimal"
          value={valor.tempBico}
          onChange={(e) => definir("tempBico")(e.target.value)}
        />
      </Grupo>
      <Grupo rotulo="Temp. mesa (°C)">
        <Entrada
          inputMode="decimal"
          value={valor.tempMesa}
          onChange={(e) => definir("tempMesa")(e.target.value)}
        />
      </Grupo>
      <Grupo rotulo="Preenchimento">
        <Entrada
          value={valor.preenchimento}
          onChange={(e) => definir("preenchimento")(e.target.value)}
          placeholder="20%"
        />
      </Grupo>
      <Grupo rotulo="Altura da camada (mm)">
        <Entrada
          inputMode="decimal"
          value={valor.alturaCamada}
          onChange={(e) => definir("alturaCamada")(e.target.value)}
        />
      </Grupo>
      <Grupo rotulo="Diâmetro do bico (mm)">
        <Entrada
          inputMode="decimal"
          value={valor.diametroBico}
          onChange={(e) => definir("diametroBico")(e.target.value)}
        />
      </Grupo>
      <Grupo rotulo="Peso estimado (g)">
        <Entrada
          inputMode="decimal"
          value={valor.pesoEstimado}
          onChange={(e) => definir("pesoEstimado")(e.target.value)}
        />
      </Grupo>
      <Grupo rotulo="Tempo estimado">
        <Entrada
          value={valor.tempoEstimado}
          onChange={(e) => definir("tempoEstimado")(e.target.value)}
          placeholder="3h 40min"
        />
      </Grupo>
    </div>
  );
}
