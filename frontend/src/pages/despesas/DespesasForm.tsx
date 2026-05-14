import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "../../components/sidebar";
import { IconAlert, IconCheck, IconClock, IconMoney } from "../../components/ui/icons";
import "./DespesasForm.css";

const API = "http://localhost:3001/api";

interface DespesaFormData {
  descricao: string;
  valor: number;
  status: string;
  data: string;
}

type ToastType = "ok" | "err";

interface ToastState {
  msg: string;
  type: ToastType;
  visible: boolean;
}

export default function DespesasForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>({ msg: "", type: "ok", visible: false });

  const [formData, setFormData] = useState<DespesaFormData>({
    descricao: "",
    valor: 0,
    status: "pendente",
    data: new Date().toISOString().split("T")[0]
  });

  // 🔥 FUNÇÃO PADRÃO COM TOKEN
  function api(url: string, options: any = {}) {
    const token = localStorage.getItem("token");

    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...options.headers
      }
    });
  }

  function showToast(msg: string, type: ToastType = "ok") {
    setToast({ msg, type, visible: true });
    window.setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2800);
  }

  // 🔥 carregar despesa (edição)
  useEffect(() => {
    async function fetchDespesa() {
      if (!isEditing) return;

      setLoading(true);
      try {
        const res = await api(`${API}/despesas/${id}`);
        const data = await res.json();

        setFormData({
          descricao: data.descricao,
          valor: data.valor,
          status: data.status,
          data: data.data.split("T")[0]
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchDespesa();
  }, [id]);

  function handleChange(e: any) {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: name === "valor" ? parseFloat(value) || 0 : value
    }));
  }

  async function handleSubmit(e: any) {
    e.preventDefault();

    if (formData.valor <= 0) {
      showToast("Informe um valor válido.", "err");
      return;
    }

    setSaving(true);

    try {
      let url = `${API}/despesas`;
      let method = "POST";

      if (isEditing) {
        url = `${API}/despesas/${id}`;
        method = "PUT";
      }

      const res = await api(url, {
        method,
        body: JSON.stringify(formData)
      });

      const data = await res.json();

if (!res.ok) {
  throw new Error(data.error || "Erro ao salvar");
}

      showToast(isEditing ? "Despesa atualizada com sucesso!" : "Despesa cadastrada com sucesso!");
      navigate("/despesas");
    } catch (err: any) {
  console.error(err);
  showToast(err.message || "Erro ao salvar despesa.", "err");

    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="despesas-wrapper">
        <Sidebar />
        <div className="despesas-page">
          <div className="despesas-loading">
            <IconClock style={{ width: 28, height: 28 }} />
            <p>Carregando despesa...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="despesas-wrapper">
      <Sidebar />

      <div className="despesas-page">
        <header className="df-topbar">
          <div className="df-title-block">
            <h1>{isEditing ? "Editar despesa" : "Nova despesa"}</h1>
            <p>{isEditing ? "Ajuste os dados deste lançamento" : "Cadastre uma nova despesa com poucos passos"}</p>
          </div>

          <button className="btn btn-back" onClick={() => navigate("/despesas")}>
            Voltar
          </button>
        </header>

        <div className="df-content">
          <section className="df-hero">
            <div className="df-hero-copy">
              <p className="df-kicker">Lançamento financeiro</p>
              <h2>Controle cada despesa com clareza</h2>
              <p>Um formulário mais limpo, com foco nos dados principais e leitura mais agradável.</p>
            </div>

            <div className="df-hero-box">
              <div className="df-hero-line">
                <IconMoney />
                <span>Valor, data e descrição organizados de forma objetiva</span>
              </div>
              <div className="df-hero-line">
                <IconCheck />
                <span>Feedback visual direto para salvar e atualizar</span>
              </div>
              <div className="df-hero-line">
                <IconAlert />
                <span>Campos pensados para evitar erros de lançamento</span>
              </div>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="df-card">
            <div className="df-card-header">
              <div className="df-card-icon"><IconMoney /></div>
              <div>
                <h3>{isEditing ? "Editar despesa" : "Cadastro de despesa"}</h3>
                <p>Preencha os campos abaixo para salvar o lançamento.</p>
              </div>
            </div>

            <div className="df-grid">
              <div className="df-field df-full">
                <label htmlFor="descricao">Descrição</label>
                <input
                  id="descricao"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  placeholder="Ex: Pagamento de fornecedor"
                  required
                />
              </div>

              <div className="df-field">
                <label htmlFor="valor">Valor</label>
                <input
                  id="valor"
                  type="number"
                  name="valor"
                  value={formData.valor}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="df-field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" value={formData.status} onChange={handleChange}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select>
              </div>

              <div className="df-field df-full">
                <label htmlFor="data">Data</label>
                <input
                  id="data"
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="df-footer">
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/despesas")}>
                Cancelar
              </button>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar despesa"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={`toast${toast.visible ? " show" : ""}`}>
        <span className={`toast-dot ${toast.type}`} />
        <span>{toast.msg}</span>
      </div>
    </div>
  );
}