"use client";

import { ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { compactarFoto, ehImagem, MAX_FOTOS } from "@/lib/imagem";

/** Foto que já está no banco, ou uma escolhida agora e ainda não enviada. */
export type FotoItem =
  | { tipo: "salva"; id: string }
  | { tipo: "nova"; chave: string; arquivo: File; miniatura: File; previa: string };

/**
 * As fotos do item — no máximo três.
 *
 * Os arquivos são compactados aqui, antes de qualquer envio: a foto do
 * celular chega com megabytes e vai para o banco com uns 200 KB.
 *
 * Reordenar é por setas, não por arrastar. São três quadrados, e arrastar no
 * toque disputa com a rolagem da página num formulário deste tamanho.
 */
export function FotosItem({ iniciais }: { iniciais: string[] }) {
  const [fotos, setFotos] = useState<FotoItem[]>(
    iniciais.map((id) => ({ tipo: "salva", id })),
  );
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<FotoItem | null>(null);

  const escolher = useRef<HTMLInputElement>(null);
  const campoFotos = useRef<HTMLInputElement>(null);
  const campoMiniaturas = useRef<HTMLInputElement>(null);

  /* Os arquivos nascem em memória, não num <input type="file"> — quem os
     criou foi o compactador. Esta é a forma de colocá-los no envio do
     formulário sem trocar o `action` por uma função que monta o FormData. */
  useEffect(() => {
    const novas = fotos.filter((f) => f.tipo === "nova");
    const listaFotos = new DataTransfer();
    const listaMiniaturas = new DataTransfer();

    for (const foto of novas) {
      listaFotos.items.add(foto.arquivo);
      listaMiniaturas.items.add(foto.miniatura);
    }

    if (campoFotos.current) campoFotos.current.files = listaFotos.files;
    if (campoMiniaturas.current) campoMiniaturas.current.files = listaMiniaturas.files;
  }, [fotos]);

  /* Cada nova aponta para a posição dela entre as novas, que é a ordem em que
     os arquivos entraram nos campos acima. */
  const ordem = (() => {
    let indice = 0;
    return fotos.map((f) => (f.tipo === "salva" ? { id: f.id } : { nova: indice++ }));
  })();

  async function adicionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setErro(null);
    setProcessando(true);

    try {
      const espaco = MAX_FOTOS - fotos.length;
      const escolhidas = Array.from(lista).slice(0, espaco);

      if (lista.length > espaco) {
        setErro(`São no máximo ${MAX_FOTOS} fotos. As demais foram ignoradas.`);
      }

      const prontas: FotoItem[] = [];

      for (const arquivo of escolhidas) {
        if (!ehImagem(arquivo)) {
          setErro("Escolha um arquivo de imagem.");
          continue;
        }

        const { foto, miniatura } = await compactarFoto(arquivo);
        prontas.push({
          tipo: "nova",
          chave: crypto.randomUUID(),
          arquivo: foto,
          miniatura,
          previa: URL.createObjectURL(miniatura),
        });
      }

      if (prontas.length > 0) setFotos((atuais) => [...atuais, ...prontas]);
    } catch {
      setErro("Não foi possível ler esta imagem. Tente outra.");
    } finally {
      setProcessando(false);
      /* Zera o campo: escolher a mesma foto de novo precisa disparar change. */
      if (escolher.current) escolher.current.value = "";
    }
  }

  function remover(posicao: number) {
    setFotos((atuais) => {
      const fora = atuais[posicao];
      if (fora.tipo === "nova") URL.revokeObjectURL(fora.previa);
      return atuais.filter((_, i) => i !== posicao);
    });
  }

  function mover(posicao: number, passo: number) {
    setFotos((atuais) => {
      const destino = posicao + passo;
      if (destino < 0 || destino >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[posicao], copia[destino]] = [copia[destino], copia[posicao]];
      return copia;
    });
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="fotos" value={JSON.stringify(ordem)} />
      <input ref={campoFotos} type="file" name="fotoNova" multiple hidden />
      <input ref={campoMiniaturas} type="file" name="miniaturaNova" multiple hidden />

      <div className="flex flex-wrap gap-3">
        {fotos.map((foto, posicao) => (
          <figure
            key={foto.tipo === "salva" ? foto.id : foto.chave}
            className="group relative size-28 overflow-hidden rounded-lg border border-borda bg-superficie-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- bytes do
                próprio banco e blob local; não passam pelo otimizador. */}
            <img
              src={miniaturaDe(foto)}
              alt={`Foto ${posicao + 1} do item`}
              className="size-full cursor-zoom-in object-cover"
              onClick={() => setAmpliada(foto)}
            />

            {posicao === 0 && (
              <figcaption className="absolute inset-x-0 top-0 bg-marca/85 py-0.5 text-center text-[10px] font-semibold text-marca-texto">
                principal
              </figcaption>
            )}

            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-superficie/90 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <BotaoMini
                titulo="Mover para a esquerda"
                onClick={() => mover(posicao, -1)}
                desativado={posicao === 0}
              >
                <ChevronLeft className="size-3.5" />
              </BotaoMini>
              <BotaoMini
                titulo="Mover para a direita"
                onClick={() => mover(posicao, 1)}
                desativado={posicao === fotos.length - 1}
              >
                <ChevronRight className="size-3.5" />
              </BotaoMini>
              <BotaoMini titulo="Remover foto" onClick={() => remover(posicao)} perigo>
                <Trash2 className="size-3.5" />
              </BotaoMini>
            </div>
          </figure>
        ))}

        {fotos.length < MAX_FOTOS && (
          <button
            type="button"
            onClick={() => escolher.current?.click()}
            disabled={processando}
            className="flex size-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-borda-forte text-texto-fraco transition-colors hover:border-marca hover:text-marca disabled:opacity-60"
          >
            {processando ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span className="text-xs font-semibold">
              {processando ? "Compactando..." : "Adicionar"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={escolher}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => adicionar(e.target.files)}
      />

      {erro ? (
        <p className="text-xs font-medium text-perigo">{erro}</p>
      ) : (
        <p className="text-xs text-texto-fraco">
          Até {MAX_FOTOS} fotos. A primeira é a que aparece na lista e no pedido — use as setas
          para trocar a ordem.
        </p>
      )}

      <Modal
        aberto={Boolean(ampliada)}
        aoFechar={() => setAmpliada(null)}
        titulo="Foto do item"
        centralizado
        className="sm:max-w-3xl"
      >
        {ampliada && (
          // eslint-disable-next-line @next/next/no-img-element -- idem acima.
          <img
            src={fotoDe(ampliada)}
            alt="Foto do item ampliada"
            className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
          />
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function miniaturaDe(foto: FotoItem) {
  return foto.tipo === "salva" ? `/api/fotos/${foto.id}?mini=1` : foto.previa;
}

/* A que ainda não foi enviada só existe como miniatura na tela; ampliar
   exigiria uma terceira cópia em memória por foto. */
function fotoDe(foto: FotoItem) {
  return foto.tipo === "salva" ? `/api/fotos/${foto.id}` : foto.previa;
}

function BotaoMini({
  titulo,
  onClick,
  children,
  desativado,
  perigo,
}: {
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
  desativado?: boolean;
  perigo?: boolean;
}) {
  return (
    <Botao
      type="button"
      variante="fantasma"
      onClick={onClick}
      title={titulo}
      disabled={desativado}
      className={`size-6 p-0 ${perigo ? "text-perigo hover:bg-perigo-suave" : ""}`}
    >
      {children}
    </Botao>
  );
}
