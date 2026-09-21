import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /* As fotos do item vao no mesmo envio do cadastro (ate tres, ja
       compactadas pelo navegador em ~220 KB cada, mais as miniaturas). O
       padrao de 1 MB estoura com tres fotos; 2 MB deixa folga para o
       multipart e para o resto do formulario. */
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
