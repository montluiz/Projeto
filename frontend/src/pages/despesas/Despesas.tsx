import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../../components/sidebar";
import { IconClock } from "../../components/ui/icons";
import "./Despesas.css";
import "../../styles/data-panel.css";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const API = "http://localhost:3001/api";

interface Despesa {
  id_despesa: number;
  descricao: string;
  valor: number;
  status?: string;
  data?: string;
}

// ── Ícones ──────────────────────────────────────────────────────────────────
const IconPlus   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconEdit   = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash  = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IconSearch = () => <svg width="14" height="14" fill="none" stroke="#71797E" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;

// ── Auth fetch ───────────────────────────────────────────────────────────────
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...options.headers,
    },
  });
}

// ── Toast hook ───────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "del"; visible: boolean }>({ msg: "", type: "ok", visible: false });
  function show(msg: string, type: "ok" | "err" | "del" = "ok") {
    setToast({ msg, type, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }
  return { toast, show };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(date?: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function getStatusMeta(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "pago")     return { label: "Pago",     className: "is-paid" };
  if (s === "pendente") return { label: "Pendente", className: "is-pending" };
  return { label: status || "—", className: "is-neutral" };
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function Despesas() {
  const navigate = useNavigate();
  const [despesas, setDespesas]   = useState<Despesa[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const { toast, show: showToast } = useToast();

  async function fetchDespesas() {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API}/despesas`);
      if (!res.ok) {
        if (res.status === 401) {
          alert("Sessão expirada, faça login novamente");
          navigate("/login");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setDespesas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        showToast(`Erro ao carregar despesas: ${err.message}`, "err");
      } else {
        showToast("Erro ao carregar despesas. Verifique o backend.", "err");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDespesas(); }, []);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     despesas.reduce((s, d) => s + (d.valor || 0), 0),
    pagas:     despesas.filter(d => (d.status || "").toLowerCase() === "pago").reduce((s, d) => s + (d.valor || 0), 0),
    pendentes: despesas.filter(d => (d.status || "").toLowerCase() === "pendente").reduce((s, d) => s + (d.valor || 0), 0),
    qtdPend:   despesas.filter(d => (d.status || "").toLowerCase() === "pendente").length,
  }), [despesas]);

  // ── Filtro ───────────────────────────────────────────────────────────────
  const lista = useMemo(() =>
    despesas.filter(d => {
      const q = search.toLowerCase();
      return (
        (d.descricao || "").toLowerCase().includes(q) ||
        (d.status    || "").toLowerCase().includes(q) ||
        formatDate(d.data).includes(q)
      );
    }), [despesas, search]);

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`${API}/despesas/${confirmId}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      setConfirmId(null);
      showToast("Despesa excluída com sucesso!", "del");
      await fetchDespesas();
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        showToast(err.message || "Erro ao excluir despesa.", "err");
      } else {
        showToast("Erro ao excluir despesa.", "err");
      }
    } finally {
      setDeleting(false);
    }
  }

  function exportCSV() {
    const headers = ["ID", "Descrição", "Valor", "Data", "Status"];
    const rows    = despesas.map(d => [d.id_despesa, d.descricao, d.valor, formatDate(d.data), d.status || "—"]);
    const csv     = [headers, ...rows].map(r => r.join(";")).join("\n");
    const a       = document.createElement("a");
    a.href        = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download    = "despesas.csv";
    a.click();
    showToast("CSV exportado!", "ok");
  }

  const handleCloseModal = () => {
    setConfirmId(null);
    setDeleting(false);
  };

  const confirmDespesa = despesas.find(d => d.id_despesa === confirmId);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="despesas-wrapper">
      <Sidebar />

      <div className="despesas-page">

        {/* Topbar */}
        <header className="p-topbar">
          <div className="p-topbar-title">Despesas</div>
          <div className="p-topbar-actions">
            <button className="btn btn-primary" onClick={() => navigate("/despesas/novo")}>
              <IconPlus /> Nova Despesa
            </button>
          </div>
        </header>

        <div className="p-content">

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon si-yellow">💰</div>
              <div className="stat-info">
                <p>Total Lançado</p>
                <strong>{formatCurrency(stats.total)}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon si-green">✅</div>
              <div className="stat-info">
                <p>Total Pago</p>
                <strong>{formatCurrency(stats.pagas)}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon si-red">⚠️</div>
              <div className="stat-info">
                <p>A Pagar</p>
                <strong>{formatCurrency(stats.pendentes)}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon si-blue">🕐</div>
              <div className="stat-info">
                <p>Pendentes</p>
                <strong>{stats.qtdPend}</strong>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="data-panel">
            <div className="dp-header">
              <h3>Lista de Despesas</h3>
              <div className="dp-header-right">
                <div className="dp-search">
                  <IconSearch />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar despesa..."
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="dp-empty">
                <div className="dp-empty-icon"><IconClock style={{ width: 32, height: 32 }} /></div>
                <p>Carregando despesas...</p>
              </div>
            ) : lista.length === 0 ? (
              <div className="dp-empty">
                <div className="dp-empty-icon">💸</div>
                <p>Nenhuma despesa encontrada.<br />Clique em <strong>Nova Despesa</strong> para cadastrar.</p>
              </div>
            ) : (
              <div className="dp-table-wrap"><table className="dp-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(d => {
                    const sm = getStatusMeta(d.status);
                    return (
                      <tr key={d.id_despesa}>
                        <td className="dp-cell-muted">{d.descricao}</td>
                        <td className="dp-cell-mono" data-label="Valor">- {formatCurrency(d.valor)}</td>
                        <td className="dp-cell-muted" data-label="Data">{formatDate(d.data)}</td>
                        <td>
                          <span className={`dp-badge dp-badge-${sm.className.replace("is-", "")}`}>{sm.label}</span>
                        </td>
                        <td>
                          <div className="dp-row-actions">
                            <button
                              className="dp-btn-icon dp-edit"
                              title="Editar"
                              onClick={() => navigate(`/despesas/editar/${d.id_despesa}`)}
                            >
                              <IconEdit />
                            </button>
                            <button
                              className="dp-btn-icon dp-del"
                              title="Excluir"
                              onClick={() => setConfirmId(d.id_despesa)}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>

        </div>
      </div>

      {/* Modal de confirmação */}
      <ConfirmDialog
        open={confirmId !== null}
        title="Excluir despesa?"
        message={<>"{confirmDespesa?.descricao || 'Despesa'}" será removida permanentemente.</>}
        confirmLabel={deleting ? "Excluindo..." : "Sim, excluir"}
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={handleCloseModal}
      />

      {/* Toast */}
      <div className={`toast${toast.visible ? " show" : ""}`}>
        <span className={`toast-dot ${toast.type}`} />
        <span>{toast.msg}</span>
      </div>
    </div>
  );
}