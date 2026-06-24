import React, { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import PasswordGate from "./PasswordGate";

const COLORS = {
  ink: "#1C2541", paper: "#FAF8F4", paperRaised: "#FFFFFF",
  teal: "#0F8B8D", tealBg: "#E3F3F2", clay: "#C4622D", clayBg: "#FBEAE0",
  slate: "#6B7280", border: "#E7E2D8",
};

const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "Geography", "Kiswahili", "English", "Civics", "History"];
const FORMS = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6"];
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "hiddens2026";

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = (d = new Date()) => d.toISOString().slice(0, 7);
const fmtMoney = (n) => "TZS " + Math.round(n).toLocaleString("en-US");

const MATH_FEE = 40000;
const OTHER_SUBJECT_FEE = 20000;

function calcFee(student) {
  const subjects = student.subjects || [];
  return subjects.reduce((total, subj) => {
    return total + (subj === "Mathematics" ? MATH_FEE : OTHER_SUBJECT_FEE);
  }, 0);
}

function Pill({ tone, children }) {
  const map = {
    good: { bg: COLORS.tealBg, fg: "#075452" },
    bad: { bg: COLORS.clayBg, fg: "#7A3A18" },
    neutral: { bg: "#EFEDE5", fg: COLORS.slate },
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
      fontWeight: 600, padding: "3px 10px", borderRadius: 999,
      background: c.bg, color: c.fg, whiteSpace: "nowrap", lineHeight: 1.4,
    }}>{children}</span>
  );
}

function SubjectTag({ children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 500,
      padding: "2px 8px", borderRadius: 6, background: "#EFEDE5", color: COLORS.ink,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function IconButton({ onClick, label, children, danger }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      border: `1px solid ${COLORS.border}`, background: COLORS.paperRaised,
      color: danger ? "#9A3412" : COLORS.ink, borderRadius: 8, width: 32, height: 32,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", fontSize: 14,
    }}>{children}</button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: COLORS.paperRaised, border: `1px solid ${COLORS.border}`,
      borderRadius: 14, ...style,
    }}>{children}</div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <Card style={{ padding: "16px 18px", flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12.5, color: COLORS.slate, fontWeight: 600, letterSpacing: 0.2 }}>{label}</div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 600,
        color: accent || COLORS.ink, marginTop: 6, fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

function NavItem({ active, onClick, children, icon }) {
  return (
    <button className="nav-item" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
      padding: "10px 14px", borderRadius: 10, border: "none",
      background: active ? "rgba(255,255,255,0.12)" : "transparent",
      color: active ? "#FFFFFF" : "rgba(255,255,255,0.62)",
      fontSize: 14.5, fontWeight: active ? 600 : 500, cursor: "pointer",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      <span style={{ fontSize: 16, width: 18, textAlign: "center" }}>{icon}</span>
      <span>{children}</span>
    </button>
  );
}

function SubjectCheckboxes({ selected, onChange }) {
  const toggle = (subj) => {
    if (selected.includes(subj)) onChange(selected.filter((s) => s !== subj));
    else onChange([...selected, subj]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {SUBJECTS.map((subj) => {
        const active = selected.includes(subj);
        return (
          <button
            key={subj}
            type="button"
            onClick={() => toggle(subj)}
            className="mark-btn"
            style={{
              background: active ? COLORS.ink : "white",
              color: active ? "white" : COLORS.ink,
              borderColor: active ? COLORS.ink : COLORS.border,
            }}
          >
            {subj}
          </button>
        );
      })}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%", alignItems: "center", justifyContent: "center", color: COLORS.slate, fontSize: 14 }}>
      Loading…
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: COLORS.clayBg, color: "#7A3A18", padding: "10px 14px", borderRadius: 10,
      fontSize: 13, marginBottom: 16,
    }}>
      {message}
    </div>
  );
}

function TuitionAdmin() {
  const [view, setView] = useState("today");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [payments, setPayments] = useState({});
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", form: FORMS[0], subjects: [], phone: "" });
  const [newTopic, setNewTopic] = useState({ subject: SUBJECTS[0], teacher: "", date: todayStr(), topic: "" });
  const [search, setSearch] = useState("");
  const [formFilter, setFormFilter] = useState("All");
  const [savedFlash, setSavedFlash] = useState(false);

  const today = todayStr();
  const thisMonth = monthStr();

  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 900);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [studentsRes, attendanceRes, paymentsRes, topicsRes] = await Promise.all([
        supabase.from("students").select("*").order("name"),
        supabase.from("attendance").select("*").eq("date", today),
        supabase.from("payments").select("*").eq("month", thisMonth),
        supabase.from("topics").select("*").order("date", { ascending: false }),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (attendanceRes.error) throw attendanceRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (topicsRes.error) throw topicsRes.error;

      setStudents(studentsRes.data || []);

      const attMap = {};
      (attendanceRes.data || []).forEach((row) => {
        attMap[row.student_id] = { in: row.arrival_time || "", out: row.departure_time || "" };
      });
      setAttendance(attMap);

      const payMap = {};
      (paymentsRes.data || []).forEach((row) => {
        payMap[row.student_id] = { status: row.status, method: row.method };
      });
      setPayments(payMap);

      setTopics(topicsRes.data || []);
    } catch (err) {
      setErrorMsg("Couldn't load data. Check your internet connection and try refreshing.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [today, thisMonth]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setArrival = async (sid, time) => {
    setAttendance((prev) => ({ ...prev, [sid]: { ...(prev[sid] || {}), in: time } }));
    const { error } = await supabase.from("attendance").upsert(
      { student_id: sid, date: today, arrival_time: time, departure_time: attendance[sid]?.out || null },
      { onConflict: "student_id,date" }
    );
    if (error) { setErrorMsg("Couldn't save arrival time — check your connection."); console.error(error); }
    else flashSaved();
  };

  const setDeparture = async (sid, time) => {
    setAttendance((prev) => ({ ...prev, [sid]: { ...(prev[sid] || {}), out: time } }));
    const { error } = await supabase.from("attendance").upsert(
      { student_id: sid, date: today, departure_time: time, arrival_time: attendance[sid]?.in || null },
      { onConflict: "student_id,date" }
    );
    if (error) { setErrorMsg("Couldn't save departure time — check your connection."); console.error(error); }
    else flashSaved();
  };

  const togglePayment = async (sid, status) => {
    setPayments((prev) => ({ ...prev, [sid]: { ...(prev[sid] || {}), status } }));
    const { error } = await supabase.from("payments").upsert(
      { student_id: sid, month: thisMonth, status, method: payments[sid]?.method || null },
      { onConflict: "student_id,month" }
    );
    if (error) { setErrorMsg("Couldn't save payment status — check your connection."); console.error(error); }
    else flashSaved();
  };

  const setPaymentMethod = async (sid, method) => {
    setPayments((prev) => ({ ...prev, [sid]: { ...(prev[sid] || {}), method } }));
    const { error } = await supabase.from("payments").upsert(
      { student_id: sid, month: thisMonth, method, status: payments[sid]?.status || "paid" },
      { onConflict: "student_id,month" }
    );
    if (error) { setErrorMsg("Couldn't save payment method."); console.error(error); }
    else flashSaved();
  };

  const todayAttendance = useMemo(() => {
    return students.map((s) => {
      const rec = attendance[s.id] || {};
      return { ...s, arrival: rec.in || "", departure: rec.out || "" };
    });
  }, [students, attendance]);

  const presentCount = todayAttendance.filter((s) => s.arrival).length;
  const absentCount = students.length - presentCount;

  const monthPayments = useMemo(() => {
    return students.map((s) => ({
      ...s,
      fee: calcFee(s),
      payStatus: payments[s.id]?.status || "unpaid",
      method: payments[s.id]?.method || "—",
    }));
  }, [students, payments]);

  const paidCount = monthPayments.filter((s) => s.payStatus === "paid").length;
  const unpaidStudents = monthPayments.filter((s) => s.payStatus !== "paid");
  const collected = monthPayments.filter((s) => s.payStatus === "paid").reduce((sum, s) => sum + s.fee, 0);
  const outstanding = unpaidStudents.reduce((sum, s) => sum + s.fee, 0);

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesForm = formFilter === "All" || s.form === formFilter;
    return matchesSearch && matchesForm;
  });

  const addStudent = async () => {
    if (!newStudent.name.trim()) return;
    const { data, error } = await supabase.from("students").insert({
      name: newStudent.name.trim(),
      form: newStudent.form,
      subjects: newStudent.subjects,
      phone: newStudent.phone.trim() || null,
    }).select().single();
    if (error) { setErrorMsg("Couldn't add student — check your connection."); console.error(error); return; }
    setStudents((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewStudent({ name: "", form: FORMS[0], subjects: [], phone: "" });
    setShowAddStudent(false);
    flashSaved();
  };

  const removeStudent = async (id) => {
    if (!confirm("Remove this student? Their attendance and payment history will be deleted too.")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) { setErrorMsg("Couldn't remove student — check your connection."); console.error(error); return; }
    setStudents((prev) => prev.filter((s) => s.id !== id));
    flashSaved();
  };

  const addTopic = async () => {
    if (!newTopic.topic.trim() || !newTopic.teacher.trim()) return;
    const { data, error } = await supabase.from("topics").insert({
      subject: newTopic.subject,
      teacher: newTopic.teacher.trim(),
      date: newTopic.date,
      topic: newTopic.topic.trim(),
    }).select().single();
    if (error) { setErrorMsg("Couldn't save topic entry — check your connection."); console.error(error); return; }
    setTopics((prev) => [data, ...prev]);
    setNewTopic({ subject: SUBJECTS[0], teacher: "", date: todayStr(), topic: "" });
    setShowAddTopic(false);
    flashSaved();
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="app-shell" style={{
      display: "flex", minHeight: 720, maxWidth: 1180, width: "100%",
      background: COLORS.paper, borderRadius: 16, overflow: "hidden",
      border: `1px solid ${COLORS.border}`, color: COLORS.ink, fontSize: 14,
      boxShadow: "0 1px 3px rgba(28,37,65,0.08)",
    }}>
      <div className="sidebar" style={{
        width: 220, background: COLORS.ink, padding: "22px 14px",
        display: "flex", flexDirection: "column", gap: 4, flexShrink: 0,
      }}>
        <div className="sidebar-brand" style={{ padding: "0 10px 22px" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: "white", lineHeight: 1.2 }}>
            Hidden's Tuition
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Admin desk</div>
        </div>

        <NavItem active={view === "today"} onClick={() => setView("today")} icon="◷">Attendance</NavItem>
        <NavItem active={view === "students"} onClick={() => setView("students")} icon="◍">Students</NavItem>
        <NavItem active={view === "payments"} onClick={() => setView("payments")} icon="◆">Payments</NavItem>
        <NavItem active={view === "topics"} onClick={() => setView("topics")} icon="▤">Topics covered</NavItem>

        <div className="sidebar-footer" style={{ marginTop: "auto", padding: "14px 10px 0" }}>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div style={{ fontSize: 11, color: savedFlash ? "rgba(15,139,141,0.9)" : "rgba(255,255,255,0.3)", marginTop: 6, transition: "color 0.3s" }}>
              {savedFlash ? "Saved" : "Synced"}
            </div>
          </div>
        </div>
      </div>

      <div className="main-panel" style={{ flex: 1, padding: "28px 32px", overflow: "auto" }}>
        <ErrorBanner message={errorMsg} />

        {view === "today" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Today's attendance</h1>
              <p style={{ color: COLORS.slate, fontSize: 13.5, margin: "4px 0 0" }}>Record when each student arrives and leaves. It saves as you go.</p>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <StatCard label="Arrived today" value={presentCount} accent={COLORS.teal} />
              <StatCard label="Not arrived yet" value={absentCount} accent={COLORS.clay} />
            </div>

            <Card style={{ padding: 4, overflowX: "auto" }}>
              <table>
                <thead><tr><th>Student</th><th>Form</th><th>Arrival</th><th>Departure</th><th>Status</th></tr></thead>
                <tbody>
                  {todayAttendance.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ color: COLORS.slate }}>{s.form}</td>
                      <td>
                        <input type="time" className="input" value={s.arrival} onChange={(e) => setArrival(s.id, e.target.value)} style={{ width: 130 }} />
                      </td>
                      <td>
                        <input type="time" className="input" value={s.departure} onChange={(e) => setDeparture(s.id, e.target.value)} style={{ width: 130 }} />
                      </td>
                      <td>
                        {s.arrival ? <Pill tone="good">Arrived</Pill> : <Pill tone="bad">Not yet</Pill>}
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan="5" style={{ color: COLORS.slate, textAlign: "center", padding: "20px" }}>No students yet — add one from the Students tab.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {view === "students" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Students</h1>
                <p style={{ color: COLORS.slate, fontSize: 13.5, margin: "4px 0 0" }}>
                  {students.length} enrolled across {FORMS.length} forms.
                </p>
              </div>
              <button className="btn-primary" onClick={() => setShowAddStudent(true)}>+ Add student</button>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <input className="input" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
              <select className="input" value={formFilter} onChange={(e) => setFormFilter(e.target.value)} style={{ maxWidth: 160 }}>
                <option value="All">All forms</option>
                {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {showAddStudent && (
              <Card style={{ padding: 18, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <input className="input" placeholder="Full name" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} style={{ flex: 2, minWidth: 160 }} />
                  <select className="input" value={newStudent.form} onChange={(e) => setNewStudent({ ...newStudent, form: e.target.value })} style={{ flex: 1, minWidth: 120 }}>
                    {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <input className="input" placeholder="Phone number" value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, color: COLORS.slate, fontWeight: 600, marginBottom: 6 }}>Subjects</div>
                  <SubjectCheckboxes selected={newStudent.subjects} onChange={(subs) => setNewStudent({ ...newStudent, subjects: subs })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={addStudent}>Save student</button>
                  <button className="btn-secondary" onClick={() => setShowAddStudent(false)}>Cancel</button>
                </div>
              </Card>
            )}

            <Card style={{ padding: 4, overflowX: "auto" }}>
              <table>
                <thead><tr><th>Name</th><th>Form</th><th>Subjects</th><th>Phone</th><th></th></tr></thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ color: COLORS.slate }}>{s.form}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(s.subjects || []).map((subj) => <SubjectTag key={subj}>{subj}</SubjectTag>)}
                        </div>
                      </td>
                      <td style={{ color: COLORS.slate }}>{s.phone || "—"}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <IconButton label={`Remove ${s.name}`} danger onClick={() => removeStudent(s.id)}>✕</IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr><td colSpan="5" style={{ color: COLORS.slate, textAlign: "center", padding: "20px" }}>No students match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {view === "payments" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, margin: 0 }}>
                Payments — {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </h1>
              <p style={{ color: COLORS.slate, fontSize: 13.5, margin: "4px 0 0" }}>
                Mathematics is {fmtMoney(MATH_FEE)}, every other subject is {fmtMoney(OTHER_SUBJECT_FEE)} — each student's fee is the sum of their subjects.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <StatCard label="Collected" value={fmtMoney(collected)} accent={COLORS.teal} sub={`${paidCount} of ${students.length} paid`} />
              <StatCard label="Outstanding" value={fmtMoney(outstanding)} accent={COLORS.clay} sub={`${unpaidStudents.length} unpaid`} />
            </div>

            <Card style={{ padding: 4, overflowX: "auto" }}>
              <table>
                <thead><tr><th>Student</th><th>Form</th><th>Subjects</th><th>Fee</th><th>Status</th><th>Method</th><th></th></tr></thead>
                <tbody>
                  {monthPayments.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ color: COLORS.slate }}>{s.form}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(s.subjects || []).map((subj) => <SubjectTag key={subj}>{subj}</SubjectTag>)}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(s.fee)}</td>
                      <td>{s.payStatus === "paid" ? <Pill tone="good">Paid</Pill> : <Pill tone="bad">Unpaid</Pill>}</td>
                      <td>
                        {s.payStatus === "paid" ? (
                          <select className="input" value={s.method === "—" ? "Cash" : s.method} onChange={(e) => setPaymentMethod(s.id, e.target.value)} style={{ padding: "5px 8px", fontSize: 13, width: 150 }}>
                            <option>Cash</option>
                            <option>Mobile money</option>
                          </select>
                        ) : <span style={{ color: COLORS.slate }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button className="mark-btn" onClick={() => togglePayment(s.id, "paid")} style={{
                            background: s.payStatus === "paid" ? COLORS.teal : "white",
                            color: s.payStatus === "paid" ? "white" : COLORS.ink,
                            borderColor: s.payStatus === "paid" ? COLORS.teal : COLORS.border,
                          }}>Paid</button>
                          <button className="mark-btn" onClick={() => togglePayment(s.id, "unpaid")} style={{
                            background: s.payStatus !== "paid" ? COLORS.clay : "white",
                            color: s.payStatus !== "paid" ? "white" : COLORS.ink,
                            borderColor: s.payStatus !== "paid" ? COLORS.clay : COLORS.border,
                          }}>Unpaid</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {view === "topics" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Topics covered</h1>
                <p style={{ color: COLORS.slate, fontSize: 13.5, margin: "4px 0 0" }}>A running log per subject — so you can answer "where are we?" in one glance.</p>
              </div>
              <button className="btn-primary" onClick={() => setShowAddTopic(true)}>+ Log a topic</button>
            </div>

            {showAddTopic && (
              <Card style={{ padding: 18, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <select className="input" value={newTopic.subject} onChange={(e) => setNewTopic({ ...newTopic, subject: e.target.value })} style={{ flex: 1, minWidth: 130 }}>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className="input" placeholder="Teacher's name" value={newTopic.teacher} onChange={(e) => setNewTopic({ ...newTopic, teacher: e.target.value })} style={{ flex: 1, minWidth: 150 }} />
                  <input className="input" type="date" value={newTopic.date} onChange={(e) => setNewTopic({ ...newTopic, date: e.target.value })} style={{ flex: 1, minWidth: 130 }} />
                </div>
                <textarea className="input" placeholder="What was covered in class…" value={newTopic.topic} onChange={(e) => setNewTopic({ ...newTopic, topic: e.target.value })} style={{ width: "100%", minHeight: 60, marginBottom: 10, resize: "vertical" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={addTopic}>Save entry</button>
                  <button className="btn-secondary" onClick={() => setShowAddTopic(false)}>Cancel</button>
                </div>
              </Card>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topics.map((t) => (
                <Card key={t.id} style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{t.subject}</span>
                      <span style={{ color: COLORS.slate, fontSize: 13 }}>· {t.teacher}</span>
                    </div>
                    <span style={{ color: COLORS.slate, fontSize: 12.5 }}>{t.date}</span>
                  </div>
                  <div style={{ fontSize: 14, color: COLORS.ink }}>{t.topic}</div>
                </Card>
              ))}
              {topics.length === 0 && <p style={{ color: COLORS.slate, fontSize: 14 }}>Nothing logged yet — add the first entry above.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(
    typeof window !== "undefined" && sessionStorage.getItem("hiddens_tuition_unlocked") === "true"
  );

  if (!unlocked) {
    return <PasswordGate correctPassword={ADMIN_PASSWORD} onUnlock={() => setUnlocked(true)} />;
  }

  return <TuitionAdmin />;
}
