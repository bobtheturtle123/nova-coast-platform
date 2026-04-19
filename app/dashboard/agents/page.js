"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

// ─── Team modal ───────────────────────────────────────────────────────────────
function TeamGroupModal({ group, allAgents, onClose, onSaved }) {
  const isEdit = !!group;
  const [form, setForm] = useState({
    name:    group?.name    || "",
    members: group?.members || [],
    notes:   group?.notes   || "",
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  function toggleMember(id) {
    setForm((f) => ({
      ...f,
      members: f.members.includes(id) ? f.members.filter((x) => x !== id) : [...f.members, id],
    }));
  }

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return allAgents;
    const q = search.toLowerCase();
    return allAgents.filter((a) =>
      a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)
    );
  }, [allAgents, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const url    = isEdit ? `/api/dashboard/customer-teams/${group.id}` : "/api/dashboard/customer-teams";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-charcoal">{isEdit ? "Edit Team" : "New Team"}</h2>
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
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full mb-2" placeholder="Search customers…" />
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-52 overflow-y-auto">
              {filteredAgents.map((a) => (
                <label key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox"
                    checked={form.members.includes(a.id)}
                    onChange={() => toggleMember(a.id)}
                    className="rounded" />
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-charcoal flex-shrink-0">
                    {a.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-charcoal font-medium truncate">{a.name}</p>
                    <p className="text-xs text-gray-400 truncate">{a.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary flex-1 py-2.5">
              {saving ? "Saving…" : isEdit ? "Save Team" : "Create Team"}
            </button>
            <button type="button" onClick={onClose} className="btn-outline px-5">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function CustomerModal({ agent, onClose, onSaved }) {
  const isEdit = !!agent;
  const [form, setForm] = useState({
    name:    agent?.name    || "",
    email:   agent?.email   || "",
    phone:   agent?.phone   || "",
    company: agent?.company || "",
    notes:   agent?.notes   || "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

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
      onSaved(isEdit ? { ...agent, ...form } : { ...form, id: data.agentId, totalOrders: 0, totalSpent: 0 });
    } catch { setError("Something went wrong."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-charcoal">{isEdit ? "Edit Customer" : "New Customer"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Full Name *</label>
              <input type="text" value={form.name} onChange={set("name")} className="input-field" placeholder="Jane Smith" required />
            </div>
            <div>
              <label className="label-field">Email *</label>
              <input type="email" value={form.email} onChange={set("email")} className="input-field" placeholder="jane@example.com" required disabled={isEdit} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Phone</label>
              <input type="tel" value={form.phone} onChange={set("phone")} className="input-field" placeholder="(619) 555-0100" />
            </div>
            <div>
              <label className="label-field">Company / Brokerage</label>
              <input type="text" value={form.company} onChange={set("company")} className="input-field" placeholder="Keller Williams" />
            </div>
          </div>
          <div>
            <label className="label-field">Notes</label>
            <textarea value={form.notes} onChange={set("notes")} rows={2}
              className="input-field resize-none" placeholder="Internal notes about this customer…" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
            </button>
            <button type="button" onClick={onClose} className="btn-outline px-5">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [agents,       setAgents]       = useState([]);
  const [teams,        setTeams]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [activeTab,    setActiveTab]    = useState("customers"); // "customers" | "teams"
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam,  setEditingTeam]  = useState(null);

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

  async function loadAgents() {
    const token = await auth.currentUser?.getIdToken(true);
    const res = await fetch("/api/dashboard/agents", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const data = await res.json(); setAgents(data.agents); }
  }

  function exportCustomersCSV() {
    const headers = ["Name","Email","Phone","Company","Total Orders","Total Spent","First Order","Last Order"];
    const rows = agents.map((a) => [
      a.name || "",
      a.email || "",
      a.phone || "",
      a.company || "",
      a.totalOrders ?? 0,
      a.totalSpent ?? 0,
      a.firstOrderAt ? new Date(a.firstOrderAt._seconds ? a.firstOrderAt._seconds * 1000 : a.firstOrderAt).toLocaleDateString() : "",
      a.lastOrderAt  ? new Date(a.lastOrderAt._seconds  ? a.lastOrderAt._seconds  * 1000 : a.lastOrderAt).toLocaleDateString()  : "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `customers-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaved(updated) {
    if (editing) {
      setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    } else {
      setAgents((prev) => [updated, ...prev]);
    }
    setShowModal(false);
    setEditing(null);
  }

  async function deleteAgent(agent) {
    if (!confirm(`Remove ${agent.name} from your customer list? This does not affect existing bookings.`)) return;
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/agents/${agent.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAgents((prev) => prev.filter((a) => a.id !== agent.id));
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter((a) =>
      a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.company?.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const totalRevenue = agents.reduce((s, a) => s + (a.totalSpent || 0), 0);
  const topAgent = agents[0];

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
      const res = await fetch("/api/dashboard/customer-teams", {
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
    await fetch(`/api/dashboard/customer-teams/${team.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold text-xl text-charcoal">Customers</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {agents.length} customer{agents.length !== 1 ? "s" : ""} · ${totalRevenue.toLocaleString()} total revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "customers" && agents.length > 0 && (
            <button onClick={exportCustomersCSV} className="btn-outline text-sm px-4 py-2">
              Export CSV
            </button>
          )}
          <button
            onClick={() => activeTab === "teams" ? (setEditingTeam(null), setShowTeamModal(true)) : (setEditing(null), setShowModal(true))}
            className="btn-primary text-sm px-4 py-2">
            {activeTab === "teams" ? "+ New Team" : "+ New Customer"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { id: "customers", label: `Customers (${agents.length})` },
          { id: "teams",     label: `Teams (${teams.length})` },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? "border-charcoal text-charcoal" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "teams" ? (
        /* ── TEAMS TAB ─────────────────────────────────────────────────────── */
        <div>
          {teams.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
              <p className="font-medium text-gray-600 mb-1">No teams yet</p>
              <p className="text-sm mt-1 mb-4">Group your customers into teams for bulk gallery delivery.</p>
              <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }} className="btn-primary text-sm px-5 py-2">
                + Create First Team
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const memberAgents = team.members?.map((id) => agents.find((a) => a.id === id)).filter(Boolean) || [];
                return (
                  <div key={team.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-charcoal">{team.name}</p>
                        {team.notes && <p className="text-xs text-gray-400 mt-0.5">{team.notes}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setEditingTeam(team); setShowTeamModal(true); }}
                          className="text-gray-400 hover:text-charcoal transition-colors">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => deleteTeam(team)}
                          className="text-gray-300 hover:text-red-400 transition-colors">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {memberAgents.length === 0
                        ? <p className="text-xs text-gray-400">No members yet</p>
                        : memberAgents.map((a) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-charcoal flex-shrink-0">
                              {a.name?.[0]?.toUpperCase()}
                            </div>
                            <p className="text-xs text-charcoal truncate">{a.name}</p>
                          </div>
                        ))
                      }
                    </div>
                    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                      {memberAgents.length} member{memberAgents.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── CUSTOMERS TAB ─────────────────────────────────────────────────── */
        <>
          {/* Stats */}
          {agents.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Customers", value: agents.length },
                { label: "Total Revenue",   value: `$${totalRevenue.toLocaleString()}` },
                { label: "Top Customer",    value: topAgent?.name || "—", sub: topAgent ? `${topAgent.totalOrders} orders` : null },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                  <p className="text-xl font-semibold text-charcoal truncate">{s.value}</p>
                  {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by name, email, or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full max-w-sm"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="font-medium text-gray-600 mb-1">No customers yet</p>
              <p className="text-sm mt-1 mb-4">Customers are added automatically when someone books, or you can add them manually.</p>
              <button onClick={() => setShowModal(true)} className="btn-primary text-sm px-5 py-2">+ Add First Customer</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              No customers match your search.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-12 px-5 py-3 text-xs text-gray-400 uppercase tracking-wide font-medium border-b border-gray-100">
                <div className="col-span-4">Customer</div>
                <div className="col-span-3">Contact</div>
                <div className="col-span-2 text-right">Orders</div>
                <div className="col-span-2 text-right">Revenue</div>
                <div className="col-span-1" />
              </div>

              {filtered.map((agent) => (
                <div key={agent.id} className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0">
                  {/* Name + avatar */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-navy/8 flex items-center justify-center text-navy font-semibold text-sm flex-shrink-0">
                      {agent.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{agent.name}</p>
                      <p className="text-xs text-gray-400">
                        {agent.company ? `${agent.company} · ` : ""}
                        {agent.lastOrderAt ? new Date(agent.lastOrderAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No orders"}
                      </p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="col-span-3 min-w-0">
                    <p className="text-xs text-gray-600 truncate">{agent.email}</p>
                    {agent.phone && <p className="text-xs text-gray-400">{agent.phone}</p>}
                  </div>

                  {/* Orders */}
                  <div className="col-span-2 text-right">
                    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                      {agent.totalOrders || 0}
                    </span>
                  </div>

                  {/* Revenue */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-semibold text-charcoal">${(agent.totalSpent || 0).toLocaleString()}</p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setEditing(agent); setShowModal(true); }}
                      className="text-gray-400 hover:text-navy transition-colors"
                      title="Edit"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <Link
                      href={`/dashboard/listings?search=${encodeURIComponent(agent.email)}`}
                      className="text-gray-400 hover:text-navy transition-colors"
                      title="View listings"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => deleteAgent(agent)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                      title="Remove customer"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showModal && (
        <CustomerModal
          agent={editing}
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
