const router = require('express').Router();
const auth = require('../middleware/Auth');
const permissao = require('../middleware/permissao');
const { q } = require('../helpers/db');

const pAdmin = permissao(1);

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

router.get('/:tipo', auth, pAdmin, async (req, res) => {
  const tipo = req.params.tipo;
  const today = new Date();
  const data_fim = req.query.data_fim || formatDate(today);
  const data_inicio = req.query.data_inicio || formatDate(new Date(today.getTime() - 30 * 86400000));

  try {
    switch (tipo) {
      case 'vendas-periodo': {
        const rows = await q(
          `SELECT DATE_FORMAT(data_venda, '%d/%m/%Y') AS periodo,
                  COUNT(*) AS quantidade,
                  COALESCE(SUM(valor_total), 0) AS receita
           FROM venda
           WHERE status = 1
             AND DATE(data_venda) BETWEEN ? AND ?
           GROUP BY DATE(data_venda)
           ORDER BY data_venda DESC`,
          [data_inicio, data_fim]
        );

        return res.json({
          summary: `Vendas realizadas entre ${data_inicio} e ${data_fim}. Total de ${rows.length} dia(s) com ${rows.reduce((sum, row) => sum + Number(row.quantidade), 0)} transações.`,
          headers: ['Período', 'Quantidade', 'Receita'],
          rows: rows.map((row) => [row.periodo, String(row.quantidade), `R$ ${Number(row.receita).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]),
        });
      }

      case 'estoques-criticos': {
        const rows = await q(
          `SELECT nome AS produto,
                  quantidade_estoque AS estoque_atual,
                  estoque_minimo,
                  IFNULL((SELECT nome FROM fornecedor WHERE id_fornecedor = produto.id_fornecedor), 'Sem fornecedor') AS fornecedor
           FROM produto
           WHERE quantidade_estoque <= estoque_minimo
           ORDER BY quantidade_estoque ASC
           LIMIT 20`
        );
        return res.json({
          summary: `${rows.length} produto(s) com estoque no nível crítico ou abaixo do mínimo.`,
          headers: ['Produto', 'Estoque Atual', 'Estoque Mínimo', 'Fornecedor'],
          rows: rows.map((row) => [row.produto, String(row.estoque_atual), String(row.estoque_minimo), row.fornecedor]),
        });
      }

      case 'ordens-servico': {
        const rows = await q(
          `SELECT os.id_ordem_servico AS os,
                  c.nome AS cliente,
                  COALESCE(f.nome, 'Sem técnico') AS tecnico,
                  CASE
                    WHEN os.status_execucao = 0 THEN 'Aguardando'
                    WHEN os.status_execucao = 1 THEN 'Diagnóstico'
                    WHEN os.status_execucao = 2 THEN 'Reparo'
                    WHEN os.status_execucao = 3 THEN 'Concluída'
                    WHEN os.status_execucao = 4 THEN 'Cancelada'
                    ELSE 'Outro'
                  END AS status
           FROM ordem_servico os
           LEFT JOIN cliente c ON c.id_cliente = os.id_cliente
           LEFT JOIN funcionario f ON f.id_funcionario = os.id_tecnico
           ORDER BY os.data_abertura DESC
           LIMIT 20`
        );
        return res.json({
          summary: `${rows.length} ordens de serviço carregadas do sistema.`,
          headers: ['OS', 'Cliente', 'Técnico', 'Status'],
          rows: rows.map((row) => [String(row.os), row.cliente, row.tecnico, row.status]),
        });
      }

      case 'garantias-processadas': {
        const rows = await q(
          `SELECT og.id_garantia AS garantia,
                  os.id_ordem_servico AS os,
                  COALESCE(c.nome, 'Sem cliente') AS cliente,
                  CASE
                    WHEN og.data_fim >= CURDATE() THEN 'Ativa'
                    ELSE 'Expirada'
                  END AS status
           FROM os_garantia og
           LEFT JOIN ordem_servico os ON os.id_ordem_servico = og.id_ordem_servico
           LEFT JOIN cliente c ON c.id_cliente = os.id_cliente
           ORDER BY og.id_garantia DESC
           LIMIT 20`
        );
        return res.json({
          summary: `${rows.length} garantias encontradas no banco de dados.`,
          headers: ['Garantia', 'OS', 'Cliente', 'Status'],
          rows: rows.map((row) => [String(row.garantia), String(row.os), row.cliente, row.status]),
        });
      }

      case 'comissoes-vendedor': {
        const rows = await q(
          `SELECT f.nome AS vendedor,
                  COUNT(v.id_venda) AS vendas,
                  COALESCE(SUM(v.valor_total * COALESCE(f.percentual_comissao, 0) / 100), 0) AS comissao,
                  CONCAT(ROUND(COALESCE(f.percentual_comissao, 0), 0), '%') AS percentual
           FROM funcionario f
           LEFT JOIN venda v ON v.id_vendedor = f.id_funcionario AND v.status = 1
           GROUP BY f.id_funcionario
           ORDER BY comissao DESC
           LIMIT 20`
        );
        return res.json({
          summary: `Comissões calculadas com base nas vendas finais registradas no banco.`,
          headers: ['Vendedor', 'Vendas', 'Comissão', 'Percentual'],
          rows: rows.map((row) => [row.vendedor, String(row.vendas), `R$ ${Number(row.comissao).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, row.percentual]),
        });
      }

      case 'produtos-maior-margem': {
        const rows = await q(
          `SELECT nome AS produto,
                  ROUND((preco_venda - preco_custo) / preco_custo * 100, 0) AS margem,
                  preco_venda,
                  preco_custo
           FROM produto
           WHERE preco_custo > 0
           ORDER BY margem DESC
           LIMIT 20`
        );
        return res.json({
          summary: `Produtos com maior margem de lucro baseada nos preços cadastrados.`,
          headers: ['Produto', 'Margem', 'Preço Venda', 'Preço Compra'],
          rows: rows.map((row) => [row.produto, `${row.margem}%`, `R$ ${Number(row.preco_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `R$ ${Number(row.preco_custo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]),
        });
      }

      case 'clientes-inadiplentes': {
        const rows = await q(
          `SELECT c.nome AS cliente,
                  c.telefone,
                  COALESCE(SUM(p.valor), 0) AS valor_aberto,
                  MAX(DATE_FORMAT(p.data_vencimento, '%d/%m/%Y')) AS ultimo_vencimento
           FROM pagamento p
           LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
           WHERE p.status = 'pendente' AND DATE(p.data_vencimento) < CURDATE()
           GROUP BY c.id_cliente
           HAVING valor_aberto > 0
           ORDER BY valor_aberto DESC
           LIMIT 20`
        );
        return res.json({
          summary: `${rows.length} cliente(s) com faturas vencidas registrados no sistema.`,
          headers: ['Cliente', 'Telefone', 'Valor em Aberto', 'Último Vencimento'],
          rows: rows.map((row) => [row.cliente, row.telefone || '-', `R$ ${Number(row.valor_aberto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, row.ultimo_vencimento || '-']),
        });
      }

      case 'historico-precos-compra': {
        const rows = await q(
          `SELECT nome AS produto,
                  DATE_FORMAT(NOW(), '%d/%m/%Y') AS data,
                  preco_custo AS preco_compra,
                  CONCAT(ROUND((preco_venda - preco_custo) / preco_custo * 100, 0), '%') AS variacao
           FROM produto
           WHERE preco_custo > 0
           ORDER BY nome
           LIMIT 20`
        );
        return res.json({
          summary: `Preços de compra atuais aplicados aos produtos cadastrados no estoque.`,
          headers: ['Produto', 'Data', 'Preço Compra', 'Variação'],
          rows: rows.map((row) => [row.produto, row.data, `R$ ${Number(row.preco_compra).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, row.variacao]),
        });
      }

      case 'performance-tecnica': {
        const rows = await q(
          `SELECT f.nome AS tecnico,
                  COUNT(os.id_ordem_servico) AS ordens_concluidas,
                  ROUND(AVG(TIMESTAMPDIFF(MINUTE, os.data_recebimento, os.data_conclusao)), 0) AS tempo_medio_min,
                  CONCAT(ROUND(100 * SUM(os.status_execucao = 3) / COUNT(os.id_ordem_servico), 0), '%') AS taxa_conclusao
           FROM ordem_servico os
           LEFT JOIN funcionario f ON f.id_funcionario = os.id_tecnico
           WHERE os.status_execucao = 3
           GROUP BY f.id_funcionario
           ORDER BY taxa_conclusao DESC
           LIMIT 20`
        );
        return res.json({
          summary: `${rows.length} técnico(s) com resultados de ordens de serviço concluídas.`,
          headers: ['Técnico', 'OS Concluídas', 'Tempo Médio (min)', 'Taxa de Conclusão'],
          rows: rows.map((row) => [row.tecnico || 'Sem técnico', String(row.ordens_concluidas), String(row.tempo_medio_min || 0), row.taxa_conclusao]),
        });
      }

      case 'fluxo-caixa-diario': {
        const rows = await q(
          `SELECT DATE_FORMAT(m.data, '%d/%m/%Y') AS data,
                  SUM(CASE WHEN m.tipo = 'entrada' THEN m.valor ELSE 0 END) AS entradas,
                  SUM(CASE WHEN m.tipo = 'saida' THEN m.valor ELSE 0 END) AS saidas,
                  SUM(CASE WHEN m.tipo = 'entrada' THEN m.valor ELSE 0 END) - SUM(CASE WHEN m.tipo = 'saida' THEN m.valor ELSE 0 END) AS saldo
           FROM movimentacao_caixa m
           WHERE m.data BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND CURDATE()
           GROUP BY DATE(m.data)
           ORDER BY m.data DESC
           LIMIT 14`
        );
        return res.json({
          summary: `Fluxo de caixa diário calculado com base nas movimentações de caixa registradas.`,
          headers: ['Data', 'Entradas', 'Saídas', 'Saldo'],
          rows: rows.map((row) => [row.data, `R$ ${Number(row.entradas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `R$ ${Number(row.saidas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `R$ ${Number(row.saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]),
        });
      }

      case 'devolucao-trocas': {
        const rows = await q(
          `SELECT v.id_venda AS pedido,
                  'Devolução' AS tipo,
                  v.valor_total AS valor,
                  CASE WHEN v.status = 0 THEN 'Cancelado' ELSE 'Ativo' END AS status
           FROM venda v
           WHERE v.status = 0
           ORDER BY v.data_venda DESC
           LIMIT 20`
        );
        return res.json({
          summary: `${rows.length} devolução(ões) registradas como vendas canceladas.`,
          headers: ['Pedido', 'Tipo', 'Valor', 'Status'],
          rows: rows.map((row) => [String(row.pedido), row.tipo, `R$ ${Number(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, row.status]),
        });
      }

      case 'previsao-demanda': {
        const rows = await q(
          `SELECT p.nome AS produto,
                  COALESCE(SUM(iv.quantidade), 0) AS demanda_estimada,
                  p.quantidade_estoque AS estoque_atual,
                  CONCAT('Repor ', GREATEST(0, LEAST(9999, ROUND((COALESCE(SUM(iv.quantidade), 0) * 1.2) - p.quantidade_estoque))), '') AS recomendacao
           FROM produto p
           LEFT JOIN item_venda iv ON iv.id_produto = p.id_produto
           LEFT JOIN venda v ON v.id_venda = iv.id_venda AND v.status = 1
           WHERE v.data_venda >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           GROUP BY p.id_produto
           ORDER BY demanda_estimada DESC
           LIMIT 20`
        );
        return res.json({
          summary: `Previsão de demanda com base nas vendas dos últimos 30 dias.`,
          headers: ['Produto', 'Demanda Estimada', 'Estoque Atual', 'Recomendação'],
          rows: rows.map((row) => [row.produto, String(row.demanda_estimada), String(row.estoque_atual), row.recomendacao]),
        });
      }

      default:
        return res.status(404).json({ error: 'Relatório inválido' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
