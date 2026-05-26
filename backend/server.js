require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const app  = express();
const PORT = process.env.PORT || 3001;
const db = require('./db');

// ── MIDDLEWARES ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true
}), express.json(), morgan('dev'));

// ── ROTAS ─────────────────────────────────────────────────────────────────────
app.use('/api',               require('./routes/Auth'));
app.use('/api/dashboard',     require('./routes/Dashboard'));
app.use('/api/produtos',      require('./routes/Produtos'));
app.use('/api/clientes',      require('./routes/Cliente'));
app.use('/api/fornecedores',  require('./routes/Fornecedores'));
app.use('/api/funcionarios',  require('./routes/Funcionario'));
app.use('/api/cargos',        require('./routes/Funcionario'));
app.use('/api/vendas',        require('./routes/Vendas'));
app.use('/api/notificacoes',  require('./routes/Notificacoes')); 
app.use('/api/OrdemServico',  require('./routes/OrdemServico'));
app.use('/api/orcamentos',    require('./routes/Orcamentos'));
app.use('/api/caixa',         require('./routes/Caixa'));
app.use('/api/pagamentos',    require('./routes/Pagamentos'));
app.use('/api/despesas',      require('./routes/Despesas'));
app.use('/api/movimentacoes', require('./routes/movimentacoes'));
app.use('/api/loja',          require('./routes/Loja'));
app.use('/api/relatorios',    require('./routes/Relatorios'));

// ── ERRO GLOBAL ───────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ── START ─────────────────────────────────────────────────────────────────────

async function waitForDb(retries = 12, delay = 2500) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.q('SELECT 1');
      console.log('✅ Banco disponível');
      return;
    } catch (err) {
      console.warn(`DB não disponível, tentativa ${i + 1}/${retries} — aguardando ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Banco de dados indisponível após múltiplas tentativas');
}

(async () => {
  try {
    await waitForDb();
    app.listen(PORT, '0.0.0.0', () => { console.log(`Servidor rodando na porta ${PORT}`); });
  } catch (err) {
    console.error('Falha ao conectar no banco:', err.message);
    process.exit(1);
  }
})();