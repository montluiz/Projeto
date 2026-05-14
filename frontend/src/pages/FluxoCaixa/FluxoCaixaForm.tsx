import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "../../components/sidebar";
import { getUser } from "../../utils/auth";
import "./FluxoCaixaForm.css";
import { formatCurrency, formatDateTime } from "../../utils/format";

const API = "http://localhost:3001/api";

/**
 * Form para Caixa + Movimentações.
 * - Sem id  → abrir caixa (valor_abertura, observações)
 * - Com id  → editar caixa, fechar (valor_fechamento) e registrar movimentações
 *             (entrada/saida) na tabela movimentacao_caixa.
 */
export default function FluxoCaixaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = getUser();

  // Caixa
  const [valorAbertura, setValorAbertura] = useState("");
  const [valorFechamento, setValorFechamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [statusCaixa, setStatusCaixa] = useState("1"); // 1=aberto, 0=fechado
  const [idFuncionario, setIdFuncionario] = useState(
    user?.id_funcionario ? String(user.id_funcionario) : ""
  );

  // Nova movimentação
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) fetchCaixa();
  }, [id]);

  async function fetchCaixa() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/caixa/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Erro ao carregar caixa"); return; }
      const d = await res.json();
      setValorAbertura(String(d.valor_abertura ?? ""));
      setValorFechamento(d.valor_fechamento != null ? String(d.valor_fechamento) : "");
      setObservacoes(d.observacoes || "");
      setStatusCaixa(String(d.status ?? "1"));
      setIdFuncionario(String(d.id_funcionario ?? ""));
      if (Array.isArray(d.movimentacoes)) setMovimentacoes(d.movimentacoes);
    } catch { alert("Erro ao carregar caixa"); }
  }

  async function salvarCaixa(e: any) {
    e.preventDefault();
    if (!valorAbertura) { alert("Valor de abertura é obrigatório"); return; }
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const payload: any = {
        valor_abertura: Number(valorAbertura),
        observacoes: observacoes || null,
        id_funcionario: Number(idFuncionario),
        status: Number(statusCaixa),
      };
      if (id && valorFechamento) payload.valor_fechamento = Number(valorFechamento);

      const res = await fetch(
        id ? `${API}/caixa/${id}` : `${API}/caixa`,
        {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) { const e = await res.json(); alert(e.error || "Erro ao salvar"); return; }
      alert(id ? "Caixa atualizado!" : "Caixa aberto!");
      navigate("/fluxo-caixa");
    } catch { alert("Erro ao salvar caixa"); }
    finally { setLoading(false); }
  }

  async function adicionarMovimentacao(e: any) {
    e.preventDefault();
    if (!valor) { alert("Informe o valor"); return; }
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/caixa/${id}/movimentacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo,
          valor: Number(valor),
          descricao: descricao || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Erro"); return; }
      const nova = await res.json();
      setMovimentacoes(prev => [...prev, nova]);
      setValor(""); setDescricao("");
      alert("Movimentação registrada!");
    } catch { alert("Erro ao registrar movimentação"); }
    finally { setLoading(false); }
  }

  const totalEntradas = movimentacoes
    .filter(m => m.tipo === "entrada")
    .reduce((s, m) => s + Number(m.valor || 0), 0);
  const totalSaidas = movimentacoes
    .filter(m => m.tipo === "saida")
    .reduce((s, m) => s + Number(m.valor || 0), 0);
  const saldo = Number(valorAbertura || 0) + totalEntradas - totalSaidas;

  return (
    <div className="funcionarios-wrapper">
      <Sidebar />
      <div className="funcionarios-page">
        <header className="p-topbar">
          <div className="p-topbar-title">
            {id ? `Caixa #${id}` : "Abrir Caixa"}
          </div>
          <div className="p-topbar-actions">
            <button type="button" className="btn btn-back" onClick={() => navigate("/fluxo-caixa")}>Voltar</button>
          </div>
        </header>

        <div className="p-content">

          <form className="form-card" onSubmit={salvarCaixa} style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 500 }}>
              {id ? "Dados do Caixa" : "Abertura de Caixa"}
            </h3>

            <div className="form-grid">
              <div>
                <label>Valor de abertura *</label>
                <input type="number" step="0.01" value={valorAbertura}
                  onChange={e => setValorAbertura(e.target.value)} placeholder="0,00" />
              </div>

              {id && (
                <div>
                  <label>Valor de fechamento</label>
                  <input type="number" step="0.01" value={valorFechamento}
                    onChange={e => setValorFechamento(e.target.value)} placeholder="0,00" />
                </div>
              )}

              <div>
                <label>Status</label>
                <select value={statusCaixa} onChange={e => setStatusCaixa(e.target.value)}>
                  <option value="1">Aberto</option>
                  <option value="0">Fechado</option>
                </select>
              </div>

              <div>
                <label>Funcionário</label>
                <input value={idFuncionario} onChange={e => setIdFuncionario(e.target.value)} placeholder="ID" />
              </div>

              <div className="full">
                <label>Observações</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3}
                  placeholder="Anotações sobre o caixa..." />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/fluxo-caixa")}>Cancelar</button>
              <button className="btn btn-primary" disabled={loading}>
                {loading ? "Salvando..." : id ? "Salvar alterações" : "Abrir caixa"}
              </button>
            </div>
          </form>

          {id && (
            <>
              <form className="form-card" onSubmit={adicionarMovimentacao} style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 500 }}>Nova Movimentação</h3>

                <div className="form-grid">
                  <div>
                    <label>Tipo</label>
                    <select value={tipo} onChange={e => setTipo(e.target.value as any)}>
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                  </div>

                  <div>
                    <label>Valor *</label>
                    <input type="number" step="0.01" value={valor}
                      onChange={e => setValor(e.target.value)} placeholder="0,00" />
                  </div>

                  <div className="full">
                    <label>Descrição</label>
                    <input value={descricao} onChange={e => setDescricao(e.target.value)}
                      placeholder="Ex: Pagamento fornecedor, troco, etc." />
                  </div>
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" disabled={loading}>
                    {loading ? "Registrando..." : "Registrar movimentação"}
                  </button>
                </div>
              </form>

              <div className="form-card">
                <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 500 }}>Movimentações</h3>

                {movimentacoes.length === 0 ? (
                  <p style={{ color: "#71797E", fontSize: 13 }}>Nenhuma movimentação registrada.</p>
                ) : (
                  <table className="itens-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Descrição</th>
                        <th style={{ textAlign: "right" }}>Valor</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimentacoes.map((m, i) => (
                        <tr key={m.id_movimentacao || i}>
                          <td style={{ color: m.tipo === "entrada" ? "#16A34A" : "#FF4500", fontWeight: 600, textTransform: "capitalize" }}>
                            {m.tipo}
                          </td>
                          <td>{m.descricao || "—"}</td>
                          <td style={{ textAlign: "right" }}>{formatCurrency(m.valor)}</td>
                          <td>{formatDateTime(m.data)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="total-line" style={{ flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ fontSize: 13, color: "#16A34A", fontWeight: 500 }}>Entradas: {formatCurrency(totalEntradas)}</div>
                  <div style={{ fontSize: 13, color: "#FF4500", fontWeight: 500 }}>Saídas: {formatCurrency(totalSaidas)}</div>
                  <div>Saldo: {formatCurrency(saldo)}</div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
