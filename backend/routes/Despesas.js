const router   = require('express').Router();
const auth     = require('../middleware/Auth');
const permissao = require('../middleware/permissao');
const { q }    = require('../helpers/db');
const { err400, err404, err500, ok } = require('../helpers/Response');

const pCaixa  = permissao(1, 2, 5);
const pGerente = permissao(1, 2);

// ── LISTAR ────────────────────────────────────────────────────────────────────
router.get('/', auth, pCaixa, async (req, res) => {
  try {
    res.json(await q(`
      SELECT d.*, f.nome AS funcionario_nome
      FROM despesa d
      LEFT JOIN funcionario f ON f.id_funcionario = d.id_funcionario
      ORDER BY d.data DESC
    `));
  } catch (e) { err500(res, e); }
});

// ── BUSCAR POR ID ─────────────────────────────────────────────────────────────
router.get('/:id', auth, pCaixa, async (req, res) => {
  try {
    const [d] = await q(`SELECT * FROM despesa WHERE id_despesa=?`, [req.params.id]);
    if (!d) return err404(res, 'Despesa não encontrada');
    res.json(d);
  } catch (e) { err500(res, e); }
});

// ── CRIAR ─────────────────────────────────────────────────────────────────────
router.post('/', auth, pCaixa, async (req, res) => {
  const { descricao, valor, status, categoria, id_funcionario } = req.body;
  if (!valor || valor <= 0) return err400(res, 'Valor deve ser maior que zero');
  if (!descricao)           return err400(res, 'Descrição é obrigatória');

  try {
    const r = await q(
      `INSERT INTO despesa (descricao, valor, status, categoria, id_funcionario, data)
       VALUES (?,?,?,?,?,NOW())`,
      [descricao, valor, status || 'pendente', categoria || null, id_funcionario || null]
    );
    const id_despesa = r.insertId;

    // Se já criada como paga → saída no caixa
    if (status === 'pago') {
      const [caixa] = await q(
        `SELECT id_caixa FROM caixa WHERE valor_fechamento IS NULL ORDER BY data DESC LIMIT 1`
      );
      if (caixa) {
        await q(
          `INSERT INTO movimentacao_caixa (id_caixa, tipo, valor, descricao, id_referencia)
           VALUES (?, 'saida', ?, ?, ?)`,
          [caixa.id_caixa, valor, `Despesa - ${descricao}`, id_despesa]
        );
      }
    }

    res.status(201).json({ success: true, id_despesa });
  } catch (e) { err500(res, e); }
});

// ── ATUALIZAR ─────────────────────────────────────────────────────────────────
router.put('/:id', auth, pCaixa, async (req, res) => {
  const { descricao, valor, status, categoria, id_funcionario } = req.body;
  try {
    const [d] = await q(`SELECT * FROM despesa WHERE id_despesa=?`, [req.params.id]);
    if (!d) return err404(res, 'Despesa não encontrada');

    await q(
      `UPDATE despesa SET descricao=?, valor=?, status=?, categoria=?, id_funcionario=?
       WHERE id_despesa=?`,
      [
        descricao   ?? d.descricao,
        valor       ?? d.valor,
        status      ?? d.status,
        categoria   ?? d.categoria,
        id_funcionario ?? d.id_funcionario,
        req.params.id
      ]
    );

    // Se virou pago agora → saída no caixa
    if (status === 'pago' && d.status !== 'pago') {
      const [caixa] = await q(
        `SELECT id_caixa FROM caixa WHERE valor_fechamento IS NULL ORDER BY data DESC LIMIT 1`
      );
      if (caixa) {
        await q(
          `INSERT INTO movimentacao_caixa (id_caixa, tipo, valor, descricao, id_referencia)
           VALUES (?, 'saida', ?, ?, ?)`,
          [caixa.id_caixa, valor ?? d.valor, `Despesa - ${descricao ?? d.descricao}`, req.params.id]
        );
      }
    }

    ok(res, { message: 'Despesa atualizada com sucesso' });
  } catch (e) { err500(res, e); }
});

// ── EXCLUIR — só gerente ──────────────────────────────────────────────────────
router.delete('/:id', auth, pGerente, async (req, res) => {
  try {
    const [d] = await q(`SELECT id_despesa, status FROM despesa WHERE id_despesa=?`, [req.params.id]);
    if (!d) return err404(res, 'Despesa não encontrada');
    if (d.status === 'pago') return err400(res, 'Não é possível excluir despesa já paga');
    await q(`DELETE FROM despesa WHERE id_despesa=?`, [req.params.id]);
    ok(res, { message: 'Despesa excluída com sucesso' });
  } catch (e) { err500(res, e); }
});

module.exports = router;