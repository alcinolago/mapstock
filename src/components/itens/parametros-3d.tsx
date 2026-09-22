"use client";

import { Entrada, Grupo, Selecao } from "@/components/ui/campo";
import { CampoNumero } from "@/components/ui/campo-mascarado";

export type Params3D = {
  /** Aponta para a lista de materiais, editável em Configurações. */
  materialId: string;
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
  materialId: "",
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
  materiais,
  aoMudar,
}: {
  valor: Params3D;
  materiais: { id: string; nome: string }[];
  aoMudar: (v: Params3D) => void;
}) {
  const definir = (campo: keyof Params3D) => (v: string) => aoMudar({ ...valor, [campo]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Grupo rotulo="Material">
        <Selecao
          value={valor.materialId}
          onChange={(e) => definir("materialId")(e.target.value)}
        >
          <option value="">Selecione...</option>
          {materiais.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Selecao>
      </Grupo>
      <Grupo rotulo="Temp. bico (°C)">
        <CampoNumero valor={valor.tempBico} aoMudar={definir("tempBico")} />
      </Grupo>
      <Grupo rotulo="Temp. mesa (°C)">
        <CampoNumero valor={valor.tempMesa} aoMudar={definir("tempMesa")} />
      </Grupo>
      <Grupo rotulo="Preenchimento">
        <Entrada
          value={valor.preenchimento}
          onChange={(e) => definir("preenchimento")(e.target.value)}
          placeholder="20%"
        />
      </Grupo>
      <Grupo rotulo="Altura da camada (mm)">
        <CampoNumero valor={valor.alturaCamada} aoMudar={definir("alturaCamada")} />
      </Grupo>
      <Grupo rotulo="Diâmetro do bico (mm)">
        <CampoNumero valor={valor.diametroBico} aoMudar={definir("diametroBico")} />
      </Grupo>
      <Grupo rotulo="Peso estimado (g)">
        <CampoNumero valor={valor.pesoEstimado} aoMudar={definir("pesoEstimado")} />
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
