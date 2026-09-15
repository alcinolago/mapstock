/**
 * Dados de demonstracao, para conhecer o sistema antes de cadastrar o que e
 * real. Monta um equipamento completo com estrutura, fornecedores, estoque,
 * uma cotacao comparando precos e um pedido parcialmente recebido.
 *
 *   npm run db:demo            cria
 *   npm run db:demo -- limpar  apaga tudo (menos usuarios e configuracoes)
 */
import { db } from "./index";
import {
  bom,
  classificacoes,
  cotacaoItens,
  cotacaoPrecos,
  cotacoes,
  fornecedores,
  itemFornecedores,
  itens,
  itensParametros3d,
  logAuditoria,
  movimentos,
  pedidoItens,
  pedidosCompra,
  unidades,
  usuarios,
} from "./schema";
async function limpar() {
  /* Ordem importa: filho antes de pai, senao a FK barra. */
  await db.delete(movimentos);
  await db.delete(pedidoItens);
  await db.delete(pedidosCompra);
  await db.delete(cotacaoPrecos);
  await db.delete(cotacaoItens);
  await db.delete(cotacoes);
  await db.delete(bom);
  await db.delete(itemFornecedores);
  await db.delete(itensParametros3d);
  await db.delete(itens);
  await db.delete(fornecedores);
  await db.delete(logAuditoria);
  console.log("Dados de demonstração removidos. Usuários e configurações foram mantidos.");
}
async function criar() {
  const [admin] = await db.select().from(usuarios).limit(1);
  if (!admin) throw new Error("Rode `npm run db:seed` antes.");
  const classes = await db.select().from(classificacoes);
  const uns = await db.select().from(unidades);
  const classe = (nome: string) => classes.find((c) => c.nome === nome)!.id;
  const unidade = (sigla: string) => uns.find((u) => u.sigla === sigla)!.id;
  const forns = await db
    .insert(fornecedores)
    .values([
      { nome: "Parafusos Silva", contato: "Marcos", telefone: "11988887777", email: "vendas@parafusossilva.com.br", condicaoPagamento: "30 dias", status: "preferencial" },
      { nome: "Ferramentas União", contato: "Patrícia", telefone: "1133334444", email: "contato@ferrunia.com.br", condicaoPagamento: "À vista", status: "aprovado" },
      { nome: "Alumínio Estrutural SP", contato: "Rodrigo", telefone: "1145556666", condicaoPagamento: "28/56 dias", status: "aprovado" },
      { nome: "3D Insumos", contato: "Bia", telefone: "11977776666", site: "https://3dinsumos.com.br", status: "em_avaliacao" },
    ])
    .returning();
  const f = (nome: string) => forns.find((x) => x.nome === nome)!.id;
  const criados = await db
    .insert(itens)
    .values([
      { codigo: "EQP-001", descricao: "Equipamento de inspeção — montado", classificacaoId: classe("Estrutural"), unidadeId: unidade("un"), nivel: 0, aquisicao: "fabricacao_interna", origemFabricacao: "interna_montagem", criadoPor: admin.id, atualizadoPor: admin.id },
      { codigo: "EST-001", descricao: "Estrutura em perfil de alumínio 40x40", classificacaoId: classe("Estrutural"), unidadeId: unidade("conj."), nivel: 1, aquisicao: "compra_nacional", origemFabricacao: "terceiro_corte_dobra", custoUnitario: 480, estoqueMinimo: 2, localizacao: "Prateleira A1", prazoValor: 12, criadoPor: admin.id, atualizadoPor: admin.id },
      { codigo: "FIX-PAR-M6X20", descricao: "Parafuso M6x20 inox allen", classificacaoId: classe("Fixação"), unidadeId: unidade("un"), nivel: 2, aquisicao: "compra_nacional", origemFabricacao: "compra_pronta_nacional", custoUnitario: 0.92, estoqueMinimo: 200, localizacao: "Gaveta B3", prazoValor: 5, criadoPor: admin.id, atualizadoPor: admin.id },
      { codigo: "FIX-POR-M6", descricao: "Porca M6 inox autotravante", classificacaoId: classe("Fixação"), unidadeId: unidade("un"), nivel: 2, aquisicao: "compra_nacional", custoUnitario: 0.55, estoqueMinimo: 200, localizacao: "Gaveta B3", prazoValor: 5, criadoPor: admin.id, atualizadoPor: admin.id },
      { codigo: "DOM-CAR-PETG", descricao: "Carenagem frontal impressa em PETG", classificacaoId: classe("Carenagem/Domo"), unidadeId: unidade("un"), nivel: 1, aquisicao: "fabricacao_interna", origemFabricacao: "interna_impressao_3d", custoUnitario: 68, estoqueMinimo: 1, localizacao: "Prateleira C2", prazoValor: 18, prazoUnidade: "horas", criadoPor: admin.id, atualizadoPor: admin.id },
      { codigo: "SEN-CAM-001", descricao: "Câmera industrial 5MP USB3", classificacaoId: classe("Sensor"), unidadeId: unidade("un"), nivel: 1, aquisicao: "compra_importada", custoUnitario: 2150, estoqueMinimo: 1, localizacao: "Armário travado", prazoValor: 45, criadoPor: admin.id, atualizadoPor: admin.id },
      { codigo: "AUT-PLACA-001", descricao: "Placa controladora ESP32-S3", classificacaoId: classe("Eletrônica/Automação"), unidadeId: unidade("un"), nivel: 2, aquisicao: "compra_nacional", custoUnitario: 89.9, estoqueMinimo: 3, localizacao: "Armário travado", prazoValor: 7, criadoPor: admin.id, atualizadoPor: admin.id },
      { codigo: "CNS-FIL-PETG", descricao: "Filamento PETG 1,75mm preto 1kg", classificacaoId: classe("Consumível"), unidadeId: unidade("rolo"), nivel: 2, aquisicao: "compra_nacional", custoUnitario: 135, estoqueMinimo: 4, localizacao: "Sala de impressão", prazoValor: 6, criadoPor: admin.id, atualizadoPor: admin.id },
    ])
    .returning();
  const i = (codigo: string) => criados.find((x) => x.codigo === codigo)!.id;
  await db.insert(itensParametros3d).values({
    itemId: i("DOM-CAR-PETG"),
    material: "PETG",
    tempBico: "240",
    tempMesa: "80",
    preenchimento: "25%",
    alturaCamada: "0.24",
    diametroBico: "0.60",
    pesoEstimado: "310",
    tempoEstimado: "9h 20min",
  });
  await db.insert(itemFornecedores).values([
    { itemId: i("FIX-PAR-M6X20"), fornecedorId: f("Parafusos Silva"), preco: 0.92, prazoValor: 5, qtdMinima: 100, skuFornecedor: "PS-M6X20-INOX", principal: true, ordem: 0 },
    { itemId: i("FIX-PAR-M6X20"), fornecedorId: f("Ferramentas União"), preco: 1.08, prazoValor: 3, qtdMinima: 50, skuFornecedor: "FU-8821", ordem: 1 },
    { itemId: i("FIX-POR-M6"), fornecedorId: f("Parafusos Silva"), preco: 0.55, prazoValor: 5, qtdMinima: 100, principal: true, ordem: 0 },
    { itemId: i("FIX-POR-M6"), fornecedorId: f("Ferramentas União"), preco: 0.49, prazoValor: 4, qtdMinima: 200, ordem: 1 },
    { itemId: i("EST-001"), fornecedorId: f("Alumínio Estrutural SP"), preco: 480, prazoValor: 12, qtdMinima: 1, principal: true, ordem: 0 },
    { itemId: i("CNS-FIL-PETG"), fornecedorId: f("3D Insumos"), preco: 135, prazoValor: 6, qtdMinima: 2, principal: true, ordem: 0 },
    { itemId: i("AUT-PLACA-001"), fornecedorId: f("Ferramentas União"), preco: 89.9, prazoValor: 7, principal: true, ordem: 0 },
  ]);
  await db.insert(bom).values([
    { paiId: i("EQP-001"), filhoId: i("EST-001"), quantidade: 1, localMontagem: "Base", ordem: 1 },
    { paiId: i("EQP-001"), filhoId: i("DOM-CAR-PETG"), quantidade: 1, localMontagem: "Frente", ordem: 2 },
    { paiId: i("EQP-001"), filhoId: i("SEN-CAM-001"), quantidade: 2, localMontagem: "Topo", ordem: 3 },
    { paiId: i("EST-001"), filhoId: i("FIX-PAR-M6X20"), quantidade: 24, localMontagem: "Cantoneiras", ordem: 1 },
    { paiId: i("EST-001"), filhoId: i("FIX-POR-M6"), quantidade: 24, localMontagem: "Cantoneiras", ordem: 2 },
    { paiId: i("DOM-CAR-PETG"), filhoId: i("CNS-FIL-PETG"), quantidade: 0.31, obrigatorio: true, ordem: 1 },
    { paiId: i("DOM-CAR-PETG"), filhoId: i("FIX-PAR-M6X20"), quantidade: 6, obrigatorio: false, localMontagem: "Fixação da tampa", ordem: 2 },
    { paiId: i("SEN-CAM-001"), filhoId: i("AUT-PLACA-001"), quantidade: 1, ordem: 1 },
  ]);
  await db.insert(movimentos).values([
    { itemId: i("FIX-PAR-M6X20"), tipo: "entrada_compra", quantidade: 500, referencia: "NF 12043", usuarioId: admin.id },
    { itemId: i("FIX-PAR-M6X20"), tipo: "saida_producao", quantidade: 120, referencia: "EQP-001", usuarioId: admin.id },
    { itemId: i("FIX-PAR-M6X20"), tipo: "reserva", quantidade: 60, referencia: "EQP-001 lote 2", usuarioId: admin.id },
    { itemId: i("FIX-POR-M6"), tipo: "entrada_compra", quantidade: 300, referencia: "NF 12043", usuarioId: admin.id },
    { itemId: i("FIX-POR-M6"), tipo: "saida_producao", quantidade: 150, referencia: "EQP-001", usuarioId: admin.id },
    { itemId: i("EST-001"), tipo: "entrada_compra", quantidade: 3, referencia: "NF 8871", usuarioId: admin.id },
    { itemId: i("EST-001"), tipo: "saida_producao", quantidade: 2, referencia: "EQP-001", usuarioId: admin.id },
    { itemId: i("DOM-CAR-PETG"), tipo: "entrada_fabricacao", quantidade: 2, referencia: "Impressão lote 7", usuarioId: admin.id },
    { itemId: i("CNS-FIL-PETG"), tipo: "entrada_compra", quantidade: 6, referencia: "NF 9912", usuarioId: admin.id },
    { itemId: i("CNS-FIL-PETG"), tipo: "saida_producao", quantidade: 3, referencia: "Impressão lote 7", usuarioId: admin.id },
    { itemId: i("AUT-PLACA-001"), tipo: "entrada_compra", quantidade: 5, referencia: "NF 7710", usuarioId: admin.id },
    { itemId: i("AUT-PLACA-001"), tipo: "saida_producao", quantidade: 4, referencia: "SEN-CAM-001", usuarioId: admin.id },
    /* SEN-CAM-001 fica sem nenhuma entrada de proposito: aparece EM FALTA. */
  ]);
  /* Cotacao respondida: dois fornecedores no mesmo item, vencedor escolhido. */
  const ano = new Date().getFullYear();
  const [cotacao] = await db
    .insert(cotacoes)
    .values({
      numero: `COT-${ano}-0001`,
      titulo: "Reposição de fixadores e insumos",
      status: "respondida",
      observacoes: "Prazo pedido aos fornecedores: resposta até sexta.",
      criadoPor: admin.id,
    })
    .returning();
  const linhas = await db
    .insert(cotacaoItens)
    .values([
      { cotacaoId: cotacao.id, itemId: i("FIX-PAR-M6X20"), quantidade: 500 },
      { cotacaoId: cotacao.id, itemId: i("FIX-POR-M6"), quantidade: 500 },
      { cotacaoId: cotacao.id, itemId: i("CNS-FIL-PETG"), quantidade: 6 },
    ])
    .returning();
  const linha = (codigo: string) => linhas.find((l) => l.itemId === i(codigo))!.id;
  await db.insert(cotacaoPrecos).values([
    { cotacaoItemId: linha("FIX-PAR-M6X20"), fornecedorId: f("Parafusos Silva"), precoUnitario: 0.88, prazoValor: 5, escolhido: true },
    { cotacaoItemId: linha("FIX-PAR-M6X20"), fornecedorId: f("Ferramentas União"), precoUnitario: 1.05, prazoValor: 3 },
    { cotacaoItemId: linha("FIX-POR-M6"), fornecedorId: f("Parafusos Silva"), precoUnitario: 0.58, prazoValor: 5 },
    { cotacaoItemId: linha("FIX-POR-M6"), fornecedorId: f("Ferramentas União"), precoUnitario: 0.47, prazoValor: 4, escolhido: true },
    { cotacaoItemId: linha("CNS-FIL-PETG"), fornecedorId: f("3D Insumos"), precoUnitario: 128, prazoValor: 6, frete: 35, escolhido: true },
  ]);
  /* Pedido em aberto e outro parcialmente recebido. */
  const [pedido] = await db
    .insert(pedidosCompra)
    .values({
      numero: `PC-${ano}-0001`,
      fornecedorId: f("Alumínio Estrutural SP"),
      status: "parcial",
      frete: 180,
      condicaoPagamento: "28/56 dias",
      criadoPor: admin.id,
    })
    .returning();
  const [linhaPedido] = await db
    .insert(pedidoItens)
    .values({ pedidoId: pedido.id, itemId: i("EST-001"), quantidade: 4, precoUnitario: 465, quantidadeRecebida: 1 })
    .returning();
  await db.insert(movimentos).values({
    itemId: i("EST-001"),
    tipo: "entrada_compra",
    quantidade: 1,
    referencia: pedido.numero,
    usuarioId: admin.id,
    observacao: `Recebimento do pedido ${pedido.numero}`,
    pedidoItemId: linhaPedido.id,
  });
  console.log(`  ${forns.length} fornecedores`);
  console.log(`  ${criados.length} itens`);
  console.log(`  1 cotação com comparativo de preços`);
  console.log(`  1 pedido parcialmente recebido`);
  console.log("\nPronto. Entre no sistema para ver.");
}
const acao = process.argv[2] === "limpar" ? limpar : criar;
acao().catch((e) => {
  console.error(e);
  process.exit(1);
});
