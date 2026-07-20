import { useState, useEffect } from "react";

async function api(action, payload = {}) {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

export default function App() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("idle");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api("getClients").then((data) => {
      setClients(data.clients || []);
      setLoadingClients(false);
    });
  }, []);

  async function fetchTasks(clientId) {
    setLoading(true);
    setStep("fetching");
    setTasks([]);
    setStatus(null);
    const data = await api("getTasks", { clientId });
    setTasks(data.tasks || []);
    setStep("preview");
    setLoading(false);
  }

  async function updateCanvas() {
    setLoading(true);
    setStep("updating");
    const taskMarkdown = `✅ **Client Tasks:** ${tasks
      .map((t, i) => `${i + 1}. ${t.actionItem} | ${t.status} | 👤 ${t.responsible} | 📅 ${t.dueDate}`)
      .join(" | ")}`;
    const data = await api("updateCanvas", { canvasId: selectedClient.canvasId, taskMarkdown });
    setStatus(data.success
      ? { type: "success", message: `Canvas updated with ${tasks.length} task${tasks.length !== 1 ? "s" : ""}!` }
      : { type: "error", message: data.error || "Failed to update canvas" });
    setStep("done");
    setLoading(false);
  }

  function reset() {
    setSelectedClient(null);
    setTasks([]);
    setStatus(null);
    setStep("idle");
  }

  const s = {
    page: { minHeight: "100vh", background: "#0f0f0f", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" },
    card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: "2rem", width: "100%", maxWidth: 540 },
    label: { fontSize: 12, color: "#666", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" },
    select: { width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", cursor: "pointer" },
    btn: { width: "100%", padding: "12px", borderRadius: 8, border: "1px solid #2a2a2a", background: "#222", color: "#fff", fontSize: 14, cursor: "pointer", marginTop: 12 },
    btnPrimary: { width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#5865F2", color: "#fff", fontSize: 14, cursor: "pointer", marginTop: 12, fontWeight: 500 },
    taskCard: { background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: "12px 14px", marginBottom: 8 },
    badge: (status) => ({
      fontSize: 11, padding: "2px 8px", borderRadius: 4,
      background: status === "In progress" ? "#1a3a5c" : "#1a1a1a",
      color: status === "In progress" ? "#5ab4f5" : "#666",
      border: "1px solid #2a2a2a"
    }),
    successBox: { background: "#0d2b1a", border: "1px solid #1a5c34", borderRadius: 8, padding: "14px 16px", marginBottom: 12 },
    errorBox: { background: "#2b0d0d", border: "1px solid #5c1a1a", borderRadius: 8, padding: "14px 16px", marginBottom: 12 },
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: 11, color: "#444", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Editoz Club</p>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 6 }}>Canvas task updater</h1>
          <p style={{ fontSize: 13, color: "#666" }}>Select a client, preview their active tasks, then push to their Slack canvas.</p>
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={s.label}>Client</label>
          {loadingClients ? (
            <div style={{ fontSize: 13, color: "#444", padding: "10px 0" }}>Loading clients...</div>
          ) : (
            <select
              style={s.select}
              value={selectedClient?.id || ""}
              onChange={(e) => {
                const client = clients.find((c) => c.id === e.target.value);
                setSelectedClient(client || null);
                setTasks([]);
                setStatus(null);
                setStep("idle");
              }}
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {selectedClient && step === "idle" && (
          <button style={s.btnPrimary} onClick={() => fetchTasks(selectedClient.id)} disabled={loading}>
            Fetch active tasks
          </button>
        )}

        {step === "fetching" && (
          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#666", fontSize: 13 }}>
            Fetching tasks from Notion...
          </div>
        )}

        {step === "preview" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "1rem 0 10px" }}>
              <span style={{ fontSize: 13, color: "#aaa" }}>
                {tasks.length} active task{tasks.length !== 1 ? "s" : ""} for <strong style={{ color: "#fff" }}>{selectedClient.name}</strong>
              </span>
              <span style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>preview</span>
            </div>

            {tasks.length === 0 ? (
              <div style={{ ...s.taskCard, color: "#555", fontSize: 13, textAlign: "center", padding: "1.5rem" }}>
                No active tasks found for this client.
              </div>
            ) : (
              tasks.map((task, i) => (
                <div key={i} style={s.taskCard}>
                  <div style={{ fontSize: 13, color: "#e0e0e0", marginBottom: 6, fontWeight: 500 }}>
                    {i + 1}. {task.actionItem}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={s.badge(task.status)}>{task.status}</span>
                    <span style={{ fontSize: 12, color: "#555" }}>👤 {task.responsible}</span>
                    <span style={{ fontSize: 12, color: "#555" }}>📅 {task.dueDate}</span>
                  </div>
                </div>
              ))
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button style={{ ...s.btn, flex: 1, marginTop: 8 }} onClick={reset}>Start over</button>
              <button
                style={{ ...s.btnPrimary, flex: 2, marginTop: 8, opacity: tasks.length === 0 ? 0.4 : 1 }}
                onClick={updateCanvas}
                disabled={tasks.length === 0 || loading}
              >
                Push to canvas
              </button>
            </div>
          </div>
        )}

        {step === "updating" && (
          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#666", fontSize: 13 }}>
            Updating Slack canvas...
          </div>
        )}

        {step === "done" && status && (
          <div>
            <div style={status.type === "success" ? s.successBox : s.errorBox}>
              <div style={{ fontSize: 13, fontWeight: 500, color: status.type === "success" ? "#4ade80" : "#f87171" }}>
                {status.type === "success" ? "✓ " : "✕ "}{status.message}
              </div>
            </div>
            <button style={s.btn} onClick={reset}>Update another client</button>
          </div>
        )}
      </div>
    </div>
  );
}
