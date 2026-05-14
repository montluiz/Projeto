import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "../../components/sidebar";
import "./OrcamentoForm.css";

const API = "http://localhost:3001/api";

export default function OrcamentoForm() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [clientes, setClientes] = useState<any[]>([]);

  const [idCliente, setIdCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [validade, setValidade] = useState("");

  // 🔥 AGORA STRING
  const [status, setStatus] = useState("pendente");
  const [tipo, setTipo] = useState("normal");

  const [loading, setLoading] = useState(false);

  // =========================
  // LOAD
  // =========================
  useEffect(() => {
    fetchClientes();

    if (id) {
      fetchOrcamento();
    } else {
      setData(new Date().toISOString().split("T")[0]);
    }
  }, [id]);

  async function fetchClientes() {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/clientes`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setClientes(data);
  }

  async function fetchOrcamento() {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/orcamentos/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (data.status === "aceito") {
    alert("Orçamento aceito não pode ser editado.");
    navigate("/orcamentos");
    return;
  }

    setIdCliente(String(data.id_cliente));
    setDescricao(data.descricao || "");
    setValor(String(data.valor_total || ""));
    setData(data.data ? data.data.split("T")[0] : "");
    setValidade(data.validade ? data.validade.split("T")[0] : "");

    // 🔥 GARANTE QUE VEM COMO STRING
    setStatus(data.status || "pendente");
    setTipo(data.tipo || "normal");
  }

  // =========================
  // SAVE
  // =========================
  async function salvar(e: any) {
    e.preventDefault();

    if (!idCliente || !descricao || !valor || !validade) {
      alert("Preencha cliente, descrição, valor e validade");
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const payload = {
        id_cliente: Number(idCliente),
        descricao,
        valor_total: Number(valor),
        data,
        validade,

        // 🔥 AGORA CORRETO
        status,
        tipo,
      };

      const url = id
        ? `${API}/orcamentos/${id}`
        : `${API}/orcamentos`;

      const method = id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Erro ao salvar");
        return;
      }

      alert("Orçamento salvo com sucesso!");
      navigate("/orcamentos");

    } catch (err) {
      console.error(err);
      alert("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="funcionarios-wrapper">
      <Sidebar />

      <div className="funcionarios-page">
        <header className="p-topbar">
          <div className="p-topbar-title">
            {id ? "Editar Orçamento" : "Novo Orçamento"}
          </div>

          <div className="p-topbar-actions">
            <button
              type="button"
              className="btn btn-back"
              onClick={() => navigate("/orcamentos")}
            >
              Voltar
            </button>
          </div>
        </header>

        <div className="p-content">
          <form className="form-card" onSubmit={salvar}>

            {/* CLIENTE */}
            <label>Cliente</label>
            <select
              value={idCliente}
              onChange={(e) => setIdCliente(e.target.value)}
            >
              <option value="">Selecione</option>
              {clientes.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.nome}
                </option>
              ))}
            </select>

            {/* DESCRIÇÃO */}
            <label>Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />

            {/* VALOR */}
            <label>Valor</label>
            <input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />

            {/* VALIDADE */}
            <label>Validade</label>
            <input
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />

            {/* TIPO */}
            <label>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="os">Gerar Ordem de Serviço</option>
            </select>

            {/* STATUS */}
            <label>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="pendente">Pendente</option>
              <option value="aceito">Aceito</option>
              <option value="cancelado">Cancelado</option>
            </select>

            {/* BOTÕES */}
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-primary" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate("/orcamentos")}
              >
                Cancelar
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}