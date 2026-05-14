import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "../../components/sidebar";
import { getUser } from "../../utils/auth";
import "./OrdemServicoForm.css";

const API = "http://localhost:3001/api";

export default function OrdemServicoForm() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const user      = getUser();
  const isTecnico = user?.nivel === 4;
  const isGerente = user?.nivel === 1 || user?.nivel === 2;

  const [clientes,   setClientes]   = useState<any[]>([]);
  const [tecnicos,   setTecnicos]   = useState<any[]>([]);

  // Campos gerente
  const [idCliente,  setIdCliente]  = useState("");
  const [idTecnico,  setIdTecnico]  = useState("");
  const [descricao,  setDescricao]  = useState("");
  const [idOrcamento, setIdOrcamento] = useState("");

  // Campos técnico — recebimento
  const [equipamento,     setEquipamento]     = useState("");
  const [numeroSerie,     setNumeroSerie]      = useState("");
  const [condicaoEntrada, setCondicaoEntrada] = useState("");

  // Status execução
  const [statusExecucao, setStatusExecucao] = useState("0");

  const [loading, setLoading] = useState(false);

  // ── CARREGAR ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isGerente) {
      fetchClientes();
      fetchTecnicos();
    }
    if (id) fetchOS();
  }, [id]);

  async function fetchClientes() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClientes(await res.json());
    } catch { alert("Erro ao carregar clientes"); }
  }

  async function fetchTecnicos() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/funcionarios?cargo=4`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTecnicos(await res.json());
    } catch { alert("Erro ao carregar técnicos"); }
  }

  async function fetchOS() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/OrdemServico/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { alert("Erro ao carregar OS"); return; }
      const data = await res.json();

      setIdCliente(String(data.id_cliente || ""));
      setIdTecnico(String(data.id_tecnico || ""));
      setDescricao(data.descricao_problema || "");
      setIdOrcamento(String(data.id_orcamento || ""));
      setEquipamento(data.equipamento || "");
      setNumeroSerie(data.numero_serie || "");
      setCondicaoEntrada(data.condicao_entrada || "");
      setStatusExecucao(String(data.status_execucao ?? "0"));
    } catch { alert("Erro ao carregar OS"); }
  }

  // ── SALVAR GERENTE (dados gerais) ───────────────────────────────────────────
  async function salvarGerente(e: any) {
    e.preventDefault();
    if (!idCliente || !descricao) {
      alert("Cliente e descrição são obrigatórios");
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const payload = {
        id_cliente:         Number(idCliente),
        id_tecnico:         idTecnico ? Number(idTecnico) : null,
        descricao_problema: descricao,
        id_orcamento:       idOrcamento ? Number(idOrcamento) : null,
      };
      const res = await fetch(
        id ? `${API}/OrdemServico/${id}` : `${API}/OrdemServico`,
        {
          method: id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) { const e = await res.json(); alert(e.error || "Erro ao salvar"); return; }
      alert("Salvo com sucesso!");
      navigate("/ordem");
    } catch { alert("Erro ao salvar"); }
    finally { setLoading(false); }
  }

  // ── REGISTRAR RECEBIMENTO (técnico) ────────────────────────────────────────
  async function registrarRecebimento(e: any) {
    e.preventDefault();
    if (!equipamento) { alert("Nome do equipamento é obrigatório"); return; }
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/OrdemServico/${id}/recebimento`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          equipamento,
          numero_serie:     numeroSerie || null,
          condicao_entrada: condicaoEntrada || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Erro"); return; }
      alert("Recebimento registrado!");
      navigate("/ordem");
    } catch { alert("Erro ao registrar recebimento"); }
    finally { setLoading(false); }
  }

  // ── ATUALIZAR STATUS (técnico) ──────────────────────────────────────────────
  async function atualizarStatus(e: any) {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/OrdemServico/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status_execucao: Number(statusExecucao) }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Erro"); return; }
      alert("Status atualizado!");
      navigate("/ordem");
    } catch { alert("Erro ao atualizar status"); }
    finally { setLoading(false); }
  }

  // ── LABELS ──────────────────────────────────────────────────────────────────
  const statusOpcoes = [
    { value: "0", label: "Aguardando" },
    { value: "1", label: "Em diagnóstico" },
    { value: "2", label: "Em reparo" },
    { value: "3", label: "Concluída" },
    { value: "4", label: "Cancelada" },
  ];

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="funcionarios-wrapper">
      <Sidebar />
      <div className="funcionarios-page">

        <header className="p-topbar">
          <div className="p-topbar-title">
            {isTecnico ? `OS #${id} — Painel Técnico` : id ? "Editar OS" : "Nova OS"}
          </div>
          <div className="p-topbar-actions">
            <button type="button" className="btn btn-back" onClick={() => navigate("/ordem")}>
              Voltar
            </button>
          </div>
        </header>

        <div className="p-content">

          {/* ── GERENTE: formulário completo ── */}
          {isGerente && (
            <form className="form-card" onSubmit={salvarGerente}>
              <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 500 }}>Dados da OS</h3>

              <label>Cliente *</label>
              <select value={idCliente} onChange={e => setIdCliente(e.target.value)}>
                <option value="">Selecione</option>
                {clientes.map(c => (
                  <option key={c.id_cliente} value={c.id_cliente}>{c.nome}</option>
                ))}
              </select>

              <label>Técnico responsável</label>
              <select value={idTecnico} onChange={e => setIdTecnico(e.target.value)}>
                <option value="">Nenhum</option>
                {tecnicos.map(t => (
                  <option key={t.id_funcionario} value={t.id_funcionario}>{t.nome}</option>
                ))}
              </select>

              <label>Descrição do problema *</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={4}
                placeholder="Descreva o problema relatado pelo cliente..."
              />

              <label>Orçamento vinculado</label>
              <input
                type="number"
                value={idOrcamento}
                onChange={e => setIdOrcamento(e.target.value)}
                placeholder="ID do orçamento (opcional)"
              />

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btn btn-primary" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar OS"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate("/ordem")}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* ── TÉCNICO: recebimento + status ── */}
          {isTecnico && id && (
            <>
              {/* Recebimento do equipamento */}
              <form className="form-card" onSubmit={registrarRecebimento} style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 500 }}>
                  Recebimento do equipamento
                </h3>

                <label>Equipamento *</label>
                <input
                  type="text"
                  value={equipamento}
                  onChange={e => setEquipamento(e.target.value)}
                  placeholder="Ex: Notebook Dell Inspiron"
                />

                <label>Número de série</label>
                <input
                  type="text"
                  value={numeroSerie}
                  onChange={e => setNumeroSerie(e.target.value)}
                  placeholder="Opcional"
                />

                <label>Condição de entrada</label>
                <textarea
                  value={condicaoEntrada}
                  onChange={e => setCondicaoEntrada(e.target.value)}
                  rows={3}
                  placeholder="Descreva o estado físico do equipamento ao receber..."
                />

                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" disabled={loading}>
                    {loading ? "Registrando..." : "Registrar recebimento"}
                  </button>
                </div>
              </form>

              {/* Atualizar status */}
              <form className="form-card" onSubmit={atualizarStatus}>
                <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 500 }}>
                  Atualizar status da OS
                </h3>

                <label>Status atual</label>
                <select value={statusExecucao} onChange={e => setStatusExecucao(e.target.value)}>
                  {statusOpcoes.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" disabled={loading}>
                    {loading ? "Atualizando..." : "Atualizar status"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Técnico tentando criar nova OS */}
          {isTecnico && !id && (
            <div className="form-card" style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#71717a" }}>
                Técnicos não podem abrir novas OS. Contate o gerente.
              </p>
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate("/ordem")}>
                Voltar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}