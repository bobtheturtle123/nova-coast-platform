"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { avatarColor, initials } from "@/lib/avatar";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";

// Column template — computed inside component when canViewRevenue is known

// ─── Team group modal ──────────────────────────────────────────────────────────
function TeamGroupModal({ group, allAgents, onClose, onSaved }) {
  const isEdit = !!group;
  const [form, setForm] = useState({
    name:    group?.name    || "",
    members: group?.members || [],
    notes:   group?.notes   || "",
  });
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  function toggleMember(id) {
    setForm((f) => ({
      ...f,
      members: f.members.includes(id) ? f.members.filter((x) => x !== id) : [...f.members, id],
    }));
  }

  const filteredAgents = useMemo(() => {
    if (!memberSearch.trim()) return allAgents;
    const q = memberSearch.toLowerCase();
    return allAgents.filter((a) =>
      a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)
    );
  }, [allAgents, memberSearch]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const url    = isEdit ? `/api/dashboard/customer-teams/${group.id}` : "/api/dashboard/customer-teams";
      const method = isEdit ? "PATCH" : "POST";
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      onSaved(isEdit ? { ...group, ...form } : { ...form, id: data.id });
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-card relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="text-[15px] font-semibold text-[#0F172A]">{isEdit ? "Edit Team" : "New Team"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label-field">Team Name</label>
            <input type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field w-full" placeholder="e.g. RE/MAX Group, Coastal Agents" required />
          </div>
          <div>
            <label className="label-field">Notes</label>
            <input type="text" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input-field w-full" placeholder="Optional description" />
          </div>
          <div>
            <label className="label-field">Members ({form.members.length} selected)</label>
            <input type="text" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
              className="input-field w-full mb-2" placeholder="Search customers…" />
            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, maxHeight: 200, overflowY: "auto" }}>
              {filteredAgents.map((a) => {
                const on = form.members.includes(a.id);
                return (
                  <label key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                    cursor: "pointer", background: on ? "var(--accent-50)" : "transparent",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}>
                    <input type="checkbox" checked={on} onChange={() => toggleMember(a.id)}
                      style={{ width: 15, height: 15, accentColor: "var(--accent)" }} />
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", background: avatarColor(a.name || ""),
                      color: "#fff", fontSize: 10, fontWeight: 700, display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {initials(a.name || "?")}
                    </div>
                    <div className="min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }} className="truncate">{a.name}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF" }} className="truncate">{a.email}</p>
                    </div>
                  </label>
                );
              })}
              {filteredAgents.length === 0 && (
                <p style={{ fontSize: 12, color: "#9CA3AF", padding: "12px 14px" }}>No customers found.</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || !form.name.trim()}
              className="btn-primary flex-1 py-2.5 text-sm">
              {saving ? "Saving…" : isEdit ? "Save Team" : "Create Team"}
            </button>
            <button type="button" onClick={onClose} className="btn-outline px-5 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Customer modal ────────────────────────────────────────────────────────────
function CustomerModal({ agent, teams, onClose, onSaved }) {
  const isEdit = !!agent;
  const [form, setForm] = useState({
    name:    agent?.name    || "",
    email:   agent?.email   || "",
    phone:   agent?.phone   || "",
    company: agent?.company || "",
    notes:   agent?.notes   || "",
  });
  const [teamId,  setTeamId]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  function set(f) { return (e) => setForm((p) => ({ ...p, [f]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    setSaving(true); setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = isEdit
        ? await fetch(`/api/dashboard/agents/${agent.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
          })
        : await fetch("/api/dashboard/agents", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
          });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); setSaving(false); return; }

      const newCustomer = isEdit
        ? { ...agent, ...form }
        : { ...form, id: data.agentId, totalOrders: 0, totalSpent: 0 };

      if (!isEdit && teamId) {
        const team = teams.find((t) => t.id === teamId);
        const updatedMembers = [...(team?.members || []), newCustomer.id];
        await fetch(`/api/dashboard/customer-teams/${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ members: updatedMembers }),
        });
      }

      onSaved(newCustomer, teamId || null);
    } catch { setError("Something went wrong."); setSaving(false); }
  }

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-card relative w-full max-w-[480px]">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="text-[15px] font-semibold text-[#0F172A]">{isEdit ? "Edit Customer" : "New Customer"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label-field">Full Name</label>
            <input type="text" value={form.name} onChange={set("name")}
              className="input-field w-full" placeholder="Jane Smith" required />
          </div>
          <div>
            <label className="label-field">Email</label>
            <input type="email" value={form.email} onChange={set("email")}
              className="input-field w-full" placeholder="jane@example.com" required disabled={isEdit} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Phone</label>
              <input type="tel" value={form.phone} onChange={set("phone")}
                className="input-field w-full" placeholder="(619) 555-0100" />
            </div>
            <div>
              <label className="label-field">Company / Brokerage</label>
              <input type="text" value={form.company} onChange={set("company")}
                className="input-field w-full" placeholder="Keller Williams" />
            </div>
          </div>
          <div>
            <label className="label-field">Group</label>
            {teams.length === 0 ? (
              <p className="text-xs text-gray-400 mt-0.5">No groups yet — create one with "+ New team".</p>
            ) : (
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
                className="input-field w-full">
                <option value="">— No group —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="label-field">Internal Notes</label>
            <textarea value={form.notes} onChange={set("notes")} rows={3}
              className="input-field w-full resize-none" placeholder="Internal notes about this customer…" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 py-2.5 text-sm">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
            </button>
            <button type="button" onClick={onClose} className="btn-outline px-5 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [agents,        setAgents]        = useState([]);
  const [teams,         setTeams]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null); // null=all, "uncategorized", or team.id
  const [sortBy,        setSortBy]        = useState("orders");
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam,   setEditingTeam]   = useState(null);

  const { permissions, userRole } = useDashboardPermissions();
  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin" || userRole === null;
  const canViewRevenue = isOwnerOrAdmin || !!permissions?.canViewRevenue;
  const COLS = canViewRevenue ? "1.5fr 1fr 0.9fr 0.6fr 0.7fr 24px" : "1.5fr 1fr 0.9fr 0.8fr 24px";

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const token = await auth.currentUser?.getIdToken(true);
    const [agentsRes, teamsRes] = await Promise.all([
      fetch("/api/dashboard/agents",         { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/dashboard/customer-teams", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (agentsRes.ok) { const d = await agentsRes.json(); setAgents(d.agents || []); }
    if (teamsRes.ok)  { const d = await teamsRes.json();  setTeams(d.teams  || []); }
    setLoading(false);
  }

  const totalRevenue = useMemo(() => agents.reduce((s, a) => s + (a.totalSpent || 0), 0), [agents]);

  const topAgent = useMemo(() =>
    agents.reduce((best, a) =>
      (!best || (a.totalOrders || 0) > (best.totalOrders || 0)) ? a : best
    , null)
  , [agents]);

  const addedThisMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(); const m = now.getMonth();
    return agents.filter((a) => {
      if (!a.firstOrderAt) return false;
      const d = new Date(a.firstOrderAt);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [agents]);

  const allMemberIds = useMemo(() => new Set(teams.flatMap((t) => t.members || [])), [teams]);

  const uncategorizedCount = useMemo(
    () => agents.filter((a) => !allMemberIds.has(a.id)).length,
    [agents, allMemberIds]
  );

  function agentGroupName(agentId) {
    return teams.find((t) => (t.members || []).includes(agentId))?.name || null;
  }

  const filtered = useMemo(() => {
    let list = agents;

    if (selectedGroup === "uncategorized") {
      list = list.filter((a) => !allMemberIds.has(a.id));
    } else if (selectedGroup) {
      const team = teams.find((t) => t.id === selectedGroup);
      const members = new Set(team?.members || []);
      list = list.filter((a) => members.has(a.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.company?.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (sortBy === "orders")  sorted.sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0));
    if (sortBy === "revenue") sorted.sort((a, b) => (b.totalSpent  || 0) - (a.totalSpent  || 0));
    if (sortBy === "az")      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sortBy === "recent")  sorted.sort((a, b) => new Date(b.firstOrderAt || 0) - new Date(a.firstOrderAt || 0));
    if (sortBy === "active")  sorted.sort((a, b) => new Date(b.lastOrderAt  || 0) - new Date(a.lastOrderAt  || 0));
    return sorted;
  }, [agents, teams, selectedGroup, search, sortBy, allMemberIds]);

  function handleSaved(updated, addedToTeamId) {
    if (editing) {
      setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    } else {
      setAgents((prev) => [updated, ...prev]);
    }
    if (addedToTeamId) {
      setTeams((prev) => prev.map((t) =>
        t.id === addedToTeamId ? { ...t, members: [...(t.members || []), updated.id] } : t
      ));
    }
    setShowModal(false);
    setEditing(null);
  }

  async function deleteAgent(agent) {
    if (!confirm(`Remove ${agent.name} from your customer list? This does not affect existing bookings.`)) return;
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/agents/${agent.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setAgents((prev) => prev.filter((a) => a.id !== agent.id));
  }

  async function saveTeam(form) {
    const token = await auth.currentUser.getIdToken();
    if (editingTeam) {
      await fetch(`/api/dashboard/customer-teams/${editingTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      setTeams((prev) => prev.map((t) => t.id === editingTeam.id ? { ...t, ...form } : t));
    } else {
      const res  = await fetch("/api/dashboard/customer-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setTeams((prev) => [...prev, { ...form, id: data.id }]);
    }
    setShowTeamModal(false);
    setEditingTeam(null);
  }

  async function deleteTeam(team) {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/customer-teams/${team.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
  }

  function exportCustomersCSV() {
    const headers = ["Name","Email","Phone","Company","Total Orders","Total Spent","First Order","Last Order"];
    const rows = agents.map((a) => [
      a.name || "", a.email || "", a.phone || "", a.company || "",
      a.totalOrders ?? 0, a.totalSpent ?? 0,
      a.firstOrderAt ? new Date(a.firstOrderAt).toLocaleDateString() : "",
      a.lastOrderAt  ? new Date(a.lastOrderAt).toLocaleDateString()  : "",
    ]);
    const csv  = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `customers-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  const topPct = topAgent && totalRevenue > 0
    ? Math.round(((topAgent.totalSpent || 0) / totalRevenue) * 100) : 0;

  const sortedTeams = [...teams].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const selectedGroupLabel = selectedGroup === null
    ? "Group: All"
    : selectedGroup === "uncategorized"
      ? "Group: Uncategorized"
      : `Group: ${teams.find((t) => t.id === selectedGroup)?.name || ""}`;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 28px 40px" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            {agents.length} customer{agents.length !== 1 ? "s" : ""}
            {canViewRevenue && ` · $${totalRevenue.toLocaleString()} total revenue`}
            {addedThisMonth > 0 && ` · ${addedThisMonth} added this month`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {agents.length > 0 && (
            <button onClick={exportCustomersCSV}
              className="btn-outline text-sm px-3.5 py-2">
              Export CSV
            </button>
          )}
          <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }}
            className="btn-outline text-sm px-3.5 py-2">
            + New team
          </button>
          <button onClick={() => { setEditing(null); setShowModal(true); }}
            className="btn-primary text-sm px-3.5 py-2">
            + New customer
          </button>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      {agents.length === 0 ? (
        <div className="card p-16 text-center mb-5">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="font-semibold text-[#0F172A] mb-1">No customers yet</p>
          <p className="text-sm text-gray-400 mb-4">Customers are added automatically when someone books, or add them manually.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm px-5 py-2">+ Add First Customer</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 1.6fr", gap: 14, marginBottom: 20 }}>

          {/* Navy — Total Customers */}
          <div style={{
            background: "linear-gradient(135deg, #0F172A, #1E293B)",
            border: "1px solid #0F172A", borderRadius: 16, padding: "18px 20px",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Total Customers
            </p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: -0.7, lineHeight: 1.05, marginTop: 4 }}>
              {agents.length}
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              {addedThisMonth > 0 ? `+${addedThisMonth} added this month` : "All time"}
            </p>
          </div>

          {/* Gold — Total Revenue */}
          <div style={{
            background: "linear-gradient(135deg, #FEFBF4, #fff)",
            border: "1px solid #FDF3DC", borderRadius: 16, padding: "18px 20px",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#A8843F", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Total Revenue
            </p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#A8843F", letterSpacing: -0.7, lineHeight: 1.05, marginTop: 4 }}>
              {canViewRevenue ? `$${totalRevenue.toLocaleString()}` : "—"}
            </p>
            <p style={{ fontSize: 12, color: "#A8843F", opacity: 0.7 }}>lifetime · all customers</p>
          </div>

          {/* Top Customer */}
          {topAgent ? (
            <button
              onClick={() => { setEditing(topAgent); setShowModal(true); }}
              style={{
                position: "relative", overflow: "hidden",
                background: "#fff", border: "1px solid #E9ECF0", borderRadius: 16,
                padding: "18px 100px 18px 20px", textAlign: "left",
                cursor: "pointer", transition: "box-shadow .15s", width: "100%",
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{
                position: "absolute", right: 10, top: 10,
                fontSize: 9.5, fontWeight: 700, color: "#A8843F",
                background: "#FEFBF4", padding: "2px 8px", borderRadius: 99,
                border: "1px solid #FDF3DC", letterSpacing: "0.06em", textTransform: "uppercase",
              }}>★ Top customer</div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>Top Customer</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", letterSpacing: -0.3, lineHeight: 1.1, marginTop: 4 }}>
                {topAgent.name}
              </p>
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {topAgent.totalOrders} order{topAgent.totalOrders !== 1 ? "s" : ""}
                {canViewRevenue && ` · $${(topAgent.totalSpent || 0).toLocaleString()} lifetime`}
                {canViewRevenue && topPct > 0 && ` · ${topPct}% of revenue`}
              </p>
              <div style={{
                position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)",
                width: 64, height: 64, borderRadius: "50%",
                background: avatarColor(topAgent.name || ""),
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700,
              }}>
                {initials(topAgent.name || "")}
              </div>
            </button>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #E9ECF0", borderRadius: 16, padding: "18px 20px" }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>Top Customer</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 8 }}>No data yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── Body grid: groups rail + table ─────────────────────────────────── */}
      {agents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "flex-start" }}>

          {/* Groups rail */}
          <div style={{ background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 10px" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>Groups</span>
              <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }}
                style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
                + New
              </button>
            </div>

            {/* All customers */}
            <GItem
              label="All customers"
              count={agents.length}
              active={selectedGroup === null}
              onClick={() => setSelectedGroup(null)}
            />

            {/* User-defined groups */}
            {sortedTeams.map((team) => {
              const cnt = (team.members || []).filter((id) => agents.find((a) => a.id === id)).length;
              return (
                <GItem
                  key={team.id}
                  label={team.name}
                  count={cnt}
                  active={selectedGroup === team.id}
                  onClick={() => setSelectedGroup(team.id)}
                />
              );
            })}

            {/* Empty groups state */}
            {teams.length === 0 && (
              <div style={{ marginTop: 6, padding: 14, border: "1.5px dashed var(--border)", borderRadius: 9, textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>No groups yet</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>Create groups to segment your customers.</p>
              </div>
            )}

            {/* Uncategorized */}
            <GItem
              label="Uncategorized"
              count={uncategorizedCount}
              active={selectedGroup === "uncategorized"}
              onClick={() => setSelectedGroup("uncategorized")}
              muted
            />
          </div>

          {/* Table area */}
          <div>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {/* Search */}
              <div style={{
                flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: 9,
                height: 36, padding: "0 14px",
                background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 9,
              }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "#9CA3AF", flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or company…"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#0F172A", background: "transparent", fontFamily: "inherit" }}
                />
              </div>

              {/* Sort */}
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                style={{
                  height: 36, padding: "0 14px", background: "#fff",
                  border: "1px solid var(--border-subtle)", borderRadius: 9,
                  fontSize: 12.5, color: "#0F172A", cursor: "pointer",
                  fontFamily: "inherit", outline: "none",
                }}>
                <option value="orders">Sort: Most orders</option>
                <option value="revenue">Sort: Most revenue</option>
                <option value="az">Sort: A → Z</option>
                <option value="recent">Sort: Recently added</option>
                <option value="active">Sort: Recently active</option>
              </select>

              {/* Group filter dropdown */}
              <select
                value={selectedGroup === null ? "" : selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value === "" ? null : e.target.value)}
                style={{
                  height: 36, padding: "0 14px", background: "#fff",
                  border: "1px solid var(--border-subtle)", borderRadius: 9,
                  fontSize: 12.5, color: "#0F172A", cursor: "pointer",
                  fontFamily: "inherit", outline: "none",
                }}>
                <option value="">Group: All</option>
                {sortedTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value="uncategorized">Uncategorized</option>
              </select>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div style={{ background: "#fff", border: "1.5px dashed var(--border)", borderRadius: 14, padding: "32px 24px", textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>No customers match this filter</p>
                <button
                  onClick={() => { setSearch(""); setSelectedGroup(null); }}
                  style={{ fontSize: 13, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div style={{ background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden" }}>
                {/* Table header */}
                <div style={{
                  display: "grid", gridTemplateColumns: COLS,
                  padding: "10px 16px", background: "var(--bg-subtle)",
                  borderBottom: "1px solid var(--border-subtle)", gap: 10,
                }}>
                  {["Customer","Company","Group","Orders", ...(canViewRevenue ? ["Revenue"] : []),""].map((h, i) => (
                    <span key={i} style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7280", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Table rows */}
                {filtered.map((agent) => {
                  const groupName = agentGroupName(agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => { setEditing(agent); setShowModal(true); }}
                      style={{
                        display: "grid", gridTemplateColumns: COLS,
                        padding: "11px 16px", gap: 10, alignItems: "center",
                        borderBottom: "1px solid #F4F6F8", transition: "background .1s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {/* Customer: avatar + name + email */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%",
                          background: avatarColor(agent.name || ""),
                          color: "#fff", fontSize: 10.5, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {initials(agent.name || "?")}
                        </div>
                        <div className="min-w-0">
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }} className="truncate">{agent.name}</p>
                          <p style={{ fontSize: 11.5, color: "#9CA3AF" }} className="truncate">{agent.email}</p>
                        </div>
                      </div>

                      {/* Company */}
                      <p style={{ fontSize: 12.5, color: "#4B5261" }} className="truncate">{agent.company || "—"}</p>

                      {/* Group pill */}
                      <div>
                        {groupName ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            padding: "2px 9px", borderRadius: 99,
                            fontSize: 10.5, fontWeight: 600,
                            background: "var(--accent-50)", color: "var(--info-text, #1E5A8A)",
                            border: "1px solid var(--accent-100)",
                          }}>
                            {groupName}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
                        )}
                      </div>

                      {/* Orders */}
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{agent.totalOrders || 0}</p>

                      {/* Revenue */}
                      {canViewRevenue && (
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                          ${(agent.totalSpent || 0).toLocaleString()}
                        </p>
                      )}

                      {/* Chevron */}
                      <span style={{ color: "#D1D5DB", fontSize: 18, lineHeight: 1, textAlign: "right" }}>›</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <CustomerModal
          agent={editing}
          teams={teams}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
      {showTeamModal && (
        <TeamGroupModal
          group={editingTeam}
          allAgents={agents}
          onClose={() => { setShowTeamModal(false); setEditingTeam(null); }}
          onSaved={(saved) => {
            if (editingTeam) {
              setTeams((prev) => prev.map((t) => t.id === saved.id ? saved : t));
            } else {
              setTeams((prev) => [...prev, saved]);
            }
            setShowTeamModal(false);
            setEditingTeam(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Group rail item ──────────────────────────────────────────────────────────
function GItem({ label, count, active, onClick, muted }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center",
        padding: "8px 10px", borderRadius: 8, cursor: "pointer",
        background: active ? "var(--accent-50)" : "transparent",
        transition: "background .1s",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-subtle)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{
        flex: 1, fontSize: 13, fontWeight: active ? 600 : 500,
        color: muted ? "#9CA3AF" : active ? "var(--info-text, #1E5A8A)" : "#0F172A",
      }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? "var(--accent)" : "#9CA3AF" }}>
        {count}
      </span>
    </div>
  );
}
