const router = require('express').Router();
const auth   = require('../middleware/Auth');
const permissao = require('../middleware/permissao');
const { q, buildSet } = require('../helpers/db');
const { err400, err404, err500, ok } = require('../helpers/Response');

const pTecnico  = permissao(1, 2, 4);     // admin, gerente, técnico
const pGerente  = permissao(1, 2);        // só admin e gerente

// ── helper: cria notificação para um funcionário ──────────────────────────────
async function notificar(id_funcionario, titulo, mensagem) {
  try {
    await q(
      `INSERT INTO notificacao (id_funcionario, titulo, mensagem) VALUES (?, ?, ?)`,
      [id_funcionario, titulo, mensagem]
    );
  } catch (e) {
    console.error('Erro ao criar notificação:', e.message);
  }
}

// ── LISTAR ────────────────────────────────────────────────────────────────────
// ── LISTAR ────────────────────────────────────────────────────────────────────
router.get('/', auth, pTecnico, async (req, res) => {
  try {
    let filtro = '';

    if (req.user.nivel === 4) {
      // Técnico vê: as que são dele OU as que não têm técnico
      filtro = `WHERE (os.id_tecnico = ${req.user.id} OR os.id_tecnico IS NULL)`;
    }

    res.json(await q(`
      SELECT
        os.id_ordem_servico, os.descricao_problema, os.status,
        os.status_execucao,  os.id_orcamento,       os.data_abertura,
        os.data_recebimento, os.data_conclusao,     os.equipamento,
        os.numero_serie,     os.condicao_entrada,
        c.nome AS nome_cliente,
        f.nome AS nome_tecnico
      FROM ordem_servico os
      LEFT JOIN cliente     c ON c.id_cliente      = os.id_cliente
      LEFT JOIN funcionario f ON f.id_funcionario  = os.id_tecnico
      ${filtro}
      ORDER BY os.data_abertura DESC
    `));
  } catch (e) { err500(res, e); }
});

// ── BUSCAR POR ID ─────────────────────────────────────────────────────────────
router.get('/:id', auth, pTecnico, async (req, res) => {
  try {
    const [os, diagnosticos, reparos, garantia] = await Promise.all([
      q(`SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente,
                f.nome AS nome_tecnico
         FROM ordem_servico os
         LEFT JOIN cliente     c ON c.id_cliente       = os.id_cliente
         LEFT JOIN funcionario f ON f.id_funcionario   = os.id_tecnico
         WHERE os.id_ordem_servico = ?`, [req.params.id]),

      q(`SELECT d.*, f.nome AS nome_tecnico
         FROM os_diagnostico d
         LEFT JOIN funcionario f ON f.id_funcionario = d.id_tecnico
         WHERE d.id_ordem_servico = ?
         ORDER BY d.created_at ASC`, [req.params.id]),

      q(`SELECT r.*, f.nome AS nome_tecnico
         FROM os_reparo r
         LEFT JOIN funcionario f ON f.id_funcionario = r.id_tecnico
         WHERE r.id_ordem_servico = ?
         ORDER BY r.created_at ASC`, [req.params.id]),

      q(`SELECT * FROM os_garantia WHERE id_ordem_servico = ?`, [req.params.id]),
    ]);

    if (!os.length) return err404(res, 'OS não encontrada');

    // Técnico só é barrado se a OS tem OUTRO técnico vinculado
if (req.user.nivel === 4 && os[0].id_tecnico !== null && os[0].id_tecnico !== req.user.id) {
  return res.status(403).json({ error: 'Acesso negado' });
}

    res.json({ ...os[0], diagnosticos, reparos, garantia: garantia[0] || null });
  } catch (e) { err500(res, e); }
});

// ── CRIAR — admin e gerente ───────────────────────────────────────────────────
router.post('/', auth, pGerente, async (req, res) => {
  const {
    id_cliente, id_tecnico, descricao_problema,
    equipamento, numero_serie, condicao_entrada
  } = req.body;

  if (!id_cliente || !descricao_problema)
    return err400(res, 'Campos obrigatórios: id_cliente, descricao_problema');

  try {
    const r = await q(
      `INSERT INTO ordem_servico
         (id_cliente, id_tecnico, descricao_problema, status, status_execucao,
          equipamento, numero_serie, condicao_entrada, data_abertura)
       VALUES (?,?,?,0,0,?,?,?,NOW())`,
      [id_cliente, id_tecnico || null, descricao_problema,
       equipamento || null, numero_serie || null, condicao_entrada || null]
    );

    const id_ordem = r.insertId;

    // Notifica o técnico se foi atribuído
    if (id_tecnico) {
      await notificar(
        id_tecnico,
        `Nova OS #${id_ordem} atribuída`,
        `Você recebeu uma nova ordem de serviço: "${descricao_problema}". Acesse o sistema para avaliação.`
      );
    }

    res.status(201).json({ success: true, id_ordem_servico: id_ordem });
  } catch (e) { err500(res, e); }
});

// ── ATUALIZAR DADOS GERAIS — gerente+ ─────────────────────────────────────────
router.put('/:id', auth, pGerente, async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await q(`SELECT id_ordem_servico, id_tecnico FROM ordem_servico WHERE id_ordem_servico=?`, [id]);
    if (!exists.length) return err404(res, 'OS não encontrada');

    const tecnicoAnterior = exists[0].id_tecnico;
    const { cols, vals } = buildSet(req.body, [
      'id_cliente', 'id_tecnico', 'descricao_problema', 'status',
      'id_orcamento', 'equipamento', 'numero_serie', 'condicao_entrada'
    ]);
    if (!cols.length) return err400(res, 'Nada para atualizar');

    await q(`UPDATE ordem_servico SET ${cols.join(', ')} WHERE id_ordem_servico=?`, [...vals, id]);

    // Se mudou o técnico, notifica o novo
    if (req.body.id_tecnico && req.body.id_tecnico !== tecnicoAnterior) {
      await notificar(
        req.body.id_tecnico,
        `OS #${id} atribuída a você`,
        `Você foi designado para a ordem de serviço #${id}. Acesse o sistema para avaliação.`
      );
    }

    ok(res, { message: 'OS atualizada com sucesso' });
  } catch (e) { err500(res, e); }
});

// ── ATUALIZAR STATUS EXECUÇÃO — técnico pode atualizar o próprio status ───────
router.patch('/:id/status', auth, pTecnico, async (req, res) => {
  const { status_execucao } = req.body;
  // 0=Aguardando 1=Em diagnóstico 2=Em reparo 3=Concluído 4=Cancelado
  if (status_execucao === undefined) return err400(res, 'status_execucao obrigatório');

  try {
    const [os] = await q(`SELECT id_tecnico FROM ordem_servico WHERE id_ordem_servico=?`, [req.params.id]);
    if (!os) return err404(res, 'OS não encontrada');

    if (req.user.nivel === 4 && os.id_tecnico !== req.user.id)
      return res.status(403).json({ error: 'Você não pode alterar esta OS' });

    const extra = status_execucao === 3 ? ', data_conclusao=NOW()' : '';
    await q(
      `UPDATE ordem_servico SET status_execucao=? ${extra} WHERE id_ordem_servico=?`,
      [status_execucao, req.params.id]
    );
    ok(res, { message: 'Status atualizado' });
  } catch (e) { err500(res, e); }
});

// ── REGISTRAR RECEBIMENTO DO EQUIPAMENTO ──────────────────────────────────────
router.patch('/:id/recebimento', auth, pTecnico, async (req, res) => {
  const { equipamento, numero_serie, condicao_entrada } = req.body;
  if (!equipamento) return err400(res, 'Nome do equipamento é obrigatório');

  try {
    const [os] = await q(`SELECT id_tecnico FROM ordem_servico WHERE id_ordem_servico=?`, [req.params.id]);
    if (!os) return err404(res, 'OS não encontrada');

    if (req.user.nivel === 4 && os.id_tecnico !== req.user.id)
      return res.status(403).json({ error: 'Acesso negado' });

    await q(
      `UPDATE ordem_servico
       SET equipamento=?, numero_serie=?, condicao_entrada=?,
           data_recebimento=NOW(), status_execucao=1
       WHERE id_ordem_servico=?`,
      [equipamento, numero_serie || null, condicao_entrada || null, req.params.id]
    );
    ok(res, { message: 'Recebimento registrado' });
  } catch (e) { err500(res, e); }
});

// ── DIAGNÓSTICOS ──────────────────────────────────────────────────────────────
router.get('/:id/diagnosticos', auth, pTecnico, async (req, res) => {
  try {
    res.json(await q(
      `SELECT d.*, f.nome AS nome_tecnico
       FROM os_diagnostico d
       LEFT JOIN funcionario f ON f.id_funcionario = d.id_tecnico
       WHERE d.id_ordem_servico = ? ORDER BY d.created_at ASC`,
      [req.params.id]
    ));
  } catch (e) { err500(res, e); }
});

router.post('/:id/diagnosticos', auth, pTecnico, async (req, res) => {
  const { descricao } = req.body;
  if (!descricao) return err400(res, 'Descrição obrigatória');

  try {
    const [os] = await q(`SELECT id_tecnico FROM ordem_servico WHERE id_ordem_servico=?`, [req.params.id]);
    if (!os) return err404(res, 'OS não encontrada');

    if (req.user.nivel === 4 && os.id_tecnico !== req.user.id)
      return res.status(403).json({ error: 'Acesso negado' });

    const r = await q(
      `INSERT INTO os_diagnostico (id_ordem_servico, id_tecnico, descricao) VALUES (?,?,?)`,
      [req.params.id, req.user.id, descricao]
    );

    // Avança status para "Em diagnóstico" se ainda estiver aguardando
    await q(
      `UPDATE ordem_servico SET status_execucao=GREATEST(status_execucao,1) WHERE id_ordem_servico=?`,
      [req.params.id]
    );

    res.status(201).json({ success: true, id_diagnostico: r.insertId });
  } catch (e) { err500(res, e); }
});

// ── REPAROS ───────────────────────────────────────────────────────────────────
router.get('/:id/reparos', auth, pTecnico, async (req, res) => {
  try {
    res.json(await q(
      `SELECT r.*, f.nome AS nome_tecnico
       FROM os_reparo r
       LEFT JOIN funcionario f ON f.id_funcionario = r.id_tecnico
       WHERE r.id_ordem_servico = ? ORDER BY r.created_at ASC`,
      [req.params.id]
    ));
  } catch (e) { err500(res, e); }
});

router.post('/:id/reparos', auth, pTecnico, async (req, res) => {
  const { descricao, pecas_utilizadas } = req.body;
  if (!descricao) return err400(res, 'Descrição obrigatória');

  try {
    const [os] = await q(`SELECT id_tecnico FROM ordem_servico WHERE id_ordem_servico=?`, [req.params.id]);
    if (!os) return err404(res, 'OS não encontrada');

    if (req.user.nivel === 4 && os.id_tecnico !== req.user.id)
      return res.status(403).json({ error: 'Acesso negado' });

    const r = await q(
      `INSERT INTO os_reparo (id_ordem_servico, id_tecnico, descricao, pecas_utilizadas) VALUES (?,?,?,?)`,
      [req.params.id, req.user.id, descricao, pecas_utilizadas || null]
    );

    // Avança status para "Em reparo"
    await q(
      `UPDATE ordem_servico SET status_execucao=GREATEST(status_execucao,2) WHERE id_ordem_servico=?`,
      [req.params.id]
    );

    res.status(201).json({ success: true, id_reparo: r.insertId });
  } catch (e) { err500(res, e); }
});

// ── GARANTIA ──────────────────────────────────────────────────────────────────
router.post('/:id/garantia', auth, pTecnico, async (req, res) => {
  const { dias_garantia, observacoes } = req.body;
  if (!dias_garantia) return err400(res, 'dias_garantia obrigatório');

  try {
    const [os] = await q(`SELECT id_tecnico, status_execucao FROM ordem_servico WHERE id_ordem_servico=?`, [req.params.id]);
    if (!os) return err404(res, 'OS não encontrada');

    if (os.status_execucao !== 3)
      return err400(res, 'Só é possível registrar garantia em OS concluída');

    if (req.user.nivel === 4 && os.id_tecnico !== req.user.id)
      return res.status(403).json({ error: 'Acesso negado' });

    // Remove garantia anterior se existir
    await q(`DELETE FROM os_garantia WHERE id_ordem_servico=?`, [req.params.id]);

    const dataInicio = new Date();
    const dataFim    = new Date();
    dataFim.setDate(dataFim.getDate() + Number(dias_garantia));

    const r = await q(
      `INSERT INTO os_garantia (id_ordem_servico, dias_garantia, data_inicio, data_fim, observacoes)
       VALUES (?,?,?,?,?)`,
      [req.params.id, dias_garantia,
       dataInicio.toISOString().split('T')[0],
       dataFim.toISOString().split('T')[0],
       observacoes || null]
    );

    res.status(201).json({ success: true, id_garantia: r.insertId });
  } catch (e) { err500(res, e); }
});

// ── EXCLUIR — só admin e gerente ──────────────────────────────────────────────
router.delete('/:id', auth, pGerente, async (req, res) => {
  const { id } = req.params;
  try {
    const exists = await q(`SELECT id_ordem_servico FROM ordem_servico WHERE id_ordem_servico=?`, [id]);
    if (!exists.length) return err404(res, 'OS não encontrada');
    await q(`DELETE FROM ordem_servico WHERE id_ordem_servico=?`, [id]);
    ok(res, { message: 'OS deletada com sucesso' });
  } catch (e) { err500(res, e); }
});

// ── PEGAR OS (técnico se vincula) ────────────────────────────────────────────
router.patch('/:id/pegar', auth, permissao(4), async (req, res) => {
  try {
    const [os] = await q(
      `SELECT id_tecnico FROM ordem_servico WHERE id_ordem_servico = ?`,
      [req.params.id]
    );
    if (!os) return err404(res, 'OS não encontrada');
    if (os.id_tecnico) return err400(res, 'Esta OS já tem um técnico responsável');

    await q(
      `UPDATE ordem_servico SET id_tecnico = ? WHERE id_ordem_servico = ?`,
      [req.user.id, req.params.id]
    );

    ok(res, { message: 'OS vinculada com sucesso' });
  } catch (e) { err500(res, e); }
});

module.exports = router;