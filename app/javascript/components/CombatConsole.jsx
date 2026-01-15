import React, { useCallback, useEffect, useMemo, useState } from "react";

function rotateToTop(items, activeId) {
  if (!Array.isArray(items) || items.length === 0) return items;
  if (!activeId) return items;

  const idx = items.findIndex((p) => p.id === activeId);
  if (idx === -1) return items;

  return [...items.slice(idx), ...items.slice(0, idx)];
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status}: ${text}`);
  }
  return response.json();
}

export default function CombatConsole({ boot }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interrupt, setInterrupt] = useState(null);
  const [advancing, setAdvancing] = useState(false);

  const campaignId = boot?.campaignId;
  const encounterId = boot?.encounterId;

  const stateUrl = useMemo(() => {
    if (!campaignId || !encounterId) return null;
    return `/campaigns/${campaignId}/encounters/${encounterId}/state`;
  }, [campaignId, encounterId]);

  const loadState = useCallback(async () => {
    if (!stateUrl) return;
    try {
      setLoading(true);
      setError(null);
      const json = await fetchJSON(stateUrl, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      console.log("CombatConsole: received data", json);
      console.log("CombatConsole: participants count", json?.participants?.length);
      setData(json);
    } catch (e) {
      console.error("CombatConsole: error loading state", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [stateUrl]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // ✅ Derive values with safe fallbacks BEFORE any return
  const encounter = data?.encounter ?? null;
  const participants = Array.isArray(data?.participants) ? data.participants : [];
  const deadParticipants = Array.isArray(data?.dead_participants) ? data.dead_participants : [];
  const activeParticipantId = encounter?.active_participant_id ?? null;

  const rotatedParticipants = useMemo(() => {
    if (!Array.isArray(participants) || participants.length === 0) {
      console.log("CombatConsole: no participants to rotate");
      return [];
    }
    const rotated = rotateToTop(participants, activeParticipantId);
    console.log("CombatConsole: rotated participants", rotated);
    return rotated;
  }, [participants, activeParticipantId]);

  const markAsDead = useCallback(async (participantId) => {
    if (!boot?.campaignId || !boot?.encounterId || !boot?.csrfToken) {
      console.error("CombatConsole: missing boot data for markAsDead");
      return;
    }

    const url = `/campaigns/${boot.campaignId}/encounters/${boot.encounterId}/encounter_participants/${participantId}`;
    
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": boot.csrfToken,
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          encounter_participant: { state: "dead" },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark participant as dead: ${response.status}`);
      }

      // Reload state after marking as dead
      await loadState();
    } catch (e) {
      console.error("CombatConsole: error marking participant as dead", e);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [boot, loadState]);

  const advanceTurnInternal = useCallback(async () => {
    if (!boot?.campaignId || !boot?.encounterId || !boot?.csrfToken) {
      console.error("CombatConsole: missing boot data for advanceTurn");
      return;
    }

    const url = `/campaigns/${boot.campaignId}/encounters/${boot.encounterId}/advance_turn`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": boot.csrfToken,
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(`Failed to advance turn: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === "interrupt") {
        // Update state with new data before showing interrupt popup
        if (result.encounter && result.participants) {
          setData({
            encounter: result.encounter,
            participants: result.participants || [],
            dead_participants: result.dead_participants || []
          });
        }
        // Show interrupt popup
        setInterrupt(result.interrupt);
        return false; // Still processing
      } else {
        // Turn advanced successfully, reload state
        if (result.encounter && result.participants) {
          setData({
            encounter: result.encounter,
            participants: result.participants || [],
            dead_participants: result.dead_participants || []
          });
        } else {
          await loadState();
        }
        setAdvancing(false);
        return true; // Done
      }
    } catch (e) {
      console.error("CombatConsole: error advancing turn", e);
      setError(e instanceof Error ? e.message : String(e));
      setAdvancing(false);
      return true; // Done (with error)
    }
  }, [boot, loadState]);

  const advanceTurn = useCallback(async () => {
    if (advancing) return; // Prevent double-clicks
    setAdvancing(true);
    await advanceTurnInternal();
  }, [advancing, advanceTurnInternal]);

  const resolveInterrupt = useCallback(async (passed) => {
    if (!boot?.campaignId || !boot?.encounterId || !boot?.csrfToken || !interrupt) {
      return;
    }

    const url = `/campaigns/${boot.campaignId}/encounters/${boot.encounterId}/effect_targets/${interrupt.target_id}/resolve`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": boot.csrfToken,
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ passed }),
      });

      if (!response.ok) {
        throw new Error(`Failed to resolve interrupt: ${response.status}`);
      }

      // Clear interrupt and continue advancing
      setInterrupt(null);
      // Re-call advance_turn until status=ok
      let done = false;
      while (!done) {
        done = await advanceTurnInternal();
      }
    } catch (e) {
      console.error("CombatConsole: error resolving interrupt", e);
      setError(e instanceof Error ? e.message : String(e));
      setInterrupt(null);
      setAdvancing(false);
    }
  }, [boot, interrupt, advanceTurnInternal]);

  console.log("CombatConsole: rendering with", {
    encounter,
    participantsCount: participants.length,
    deadParticipantsCount: deadParticipants.length,
    activeParticipantId,
    participants,
  });

  // Now your conditional UI can safely return
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Combat Console</h1>
        <p>Loading encounter state…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Combat Console</h1>
        <p style={{ whiteSpace: "pre-wrap" }}>Error: {error}</p>
        <button type="button" onClick={loadState}>
          Retry
        </button>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Combat Console</h1>
        <p>No encounter data available</p>
        <button type="button" onClick={loadState}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Combat Console</h1>
        <p style={{ margin: "6px 0 0 0" }}>
          Encounter #{encounter.id} • Status: {encounter.status}
          {encounter.round != null ? ` • Round: ${encounter.round}` : ""}
        </p>
      </header>

      <section>
        <h2 style={{ margin: "12px 0 8px 0" }}>Initiative</h2>

        {rotatedParticipants.length === 0 ? (
          <p style={{ padding: "12px", opacity: 0.7 }}>
            No participants in this encounter yet.
          </p>
        ) : (
          <>
            {/* Active participant - separated */}
            {encounter.active_participant_id && rotatedParticipants
              .filter((p) => p.id === encounter.active_participant_id)
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    marginBottom: 16,
                    borderRadius: 12,
                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                    outline: "2px solid currentColor",
                    fontWeight: 700,
                    opacity: p.state && p.state !== "alive" ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 22, textAlign: "right", opacity: 0.6 }}>
                      ←
                    </span>
                    <img
                      src={p.avatar_url || "/default_avatar.png"}
                      alt={p.name}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid rgba(0,0,0,0.1)",
                      }}
                      onError={(e) => {
                        e.target.src = "/default_avatar.png";
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span>
                        {p.name}
                        {p.kind ? <span style={{ opacity: 0.6 }}> ({p.kind})</span> : null}
                        {p.state && p.state !== "alive" ? (
                          <span style={{ marginLeft: 8, opacity: 0.7 }}>[{p.state}]</span>
                        ) : null}
                      </span>
                      {p.active_effects && p.active_effects.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {p.active_effects.map((effectName, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                backgroundColor: "rgba(0, 123, 255, 0.15)",
                                color: "#0066cc",
                                borderRadius: 4,
                                border: "1px solid rgba(0, 123, 255, 0.3)",
                                fontWeight: 500,
                              }}
                            >
                              {effectName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ opacity: 0.85 }}>
                      <span style={{ marginRight: 10, opacity: 0.6 }}>Init</span>
                      <strong>{p.initiative_total ?? "—"}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => markAsDead(p.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                      onMouseOver={(e) => (e.target.style.backgroundColor = "#c82333")}
                      onMouseOut={(e) => (e.target.style.backgroundColor = "#dc3545")}
                    >
                      Kill Combatant
                    </button>
                  </div>
                </div>
              ))}

            {/* Remaining participants - in a bordered container */}
            {(() => {
              const remaining = rotatedParticipants.filter(
                (p) => p.id !== encounter.active_participant_id
              );
              return remaining.length > 0 ? (
                <div
                  style={{
                    border: "1px solid rgba(0,0,0,0.2)",
                    borderRadius: 12,
                    padding: "8px",
                    backgroundColor: "rgba(0, 0, 0, 0.02)",
                  }}
                >
                  <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {remaining.map((p, i) => (
                      <li
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          marginBottom: i < remaining.length - 1 ? 8 : 0,
                          borderRadius: 8,
                          opacity: p.state && p.state !== "alive" ? 0.5 : 1,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ width: 22, textAlign: "right", opacity: 0.6 }}>
                            {i + (encounter.active_participant_id ? 2 : 1)}
                          </span>
                          <img
                            src={p.avatar_url || "/default_avatar.png"}
                            alt={p.name}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "1px solid rgba(0,0,0,0.1)",
                            }}
                            onError={(e) => {
                              e.target.src = "/default_avatar.png";
                            }}
                          />
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span>
                              {p.name}
                              {p.kind ? <span style={{ opacity: 0.6 }}> ({p.kind})</span> : null}
                              {p.state && p.state !== "alive" ? (
                                <span style={{ marginLeft: 8, opacity: 0.7 }}>[{p.state}]</span>
                              ) : null}
                            </span>
                            {p.active_effects && p.active_effects.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {p.active_effects.map((effectName, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: "10px",
                                      padding: "2px 6px",
                                      backgroundColor: "rgba(0, 123, 255, 0.15)",
                                      color: "#0066cc",
                                      borderRadius: 4,
                                      border: "1px solid rgba(0, 123, 255, 0.3)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {effectName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ opacity: 0.85 }}>
                            <span style={{ marginRight: 10, opacity: 0.6 }}>Init</span>
                            <strong>{p.initiative_total ?? "—"}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => markAsDead(p.id)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              backgroundColor: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                            onMouseOver={(e) => (e.target.style.backgroundColor = "#c82333")}
                            onMouseOut={(e) => (e.target.style.backgroundColor = "#dc3545")}
                          >
                            Kill Combatant
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null;
            })()}
          </>
        )}
      </section>

      {/* Dead participants section */}
      {deadParticipants.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ margin: "12px 0 8px 0", opacity: 0.6 }}>Dead Combatants</h2>
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 12,
              padding: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.03)",
              opacity: 0.6,
            }}
          >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {deadParticipants.map((p, i) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    marginBottom: i < deadParticipants.length - 1 ? 8 : 0,
                    borderRadius: 8,
                    color: "#666",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <img
                      src={p.avatar_url || "/default_avatar.png"}
                      alt={p.name}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid rgba(0,0,0,0.1)",
                        opacity: 0.6,
                      }}
                      onError={(e) => {
                        e.target.src = "/default_avatar.png";
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span>{p.name}</span>
                      {p.kind ? (
                        <span style={{ opacity: 0.5 }}>({p.kind})</span>
                      ) : null}
                      {p.active_effects && p.active_effects.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {p.active_effects.map((effectName, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: "9px",
                                padding: "2px 5px",
                                backgroundColor: "rgba(0, 123, 255, 0.12)",
                                color: "#0066cc",
                                borderRadius: 3,
                                border: "1px solid rgba(0, 123, 255, 0.25)",
                                fontWeight: 500,
                                opacity: 0.8,
                              }}
                            >
                              {effectName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Advance Turn button */}
      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={advanceTurn}
          disabled={advancing || encounter.status !== "active"}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: advancing ? "#6c757d" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: advancing ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {advancing ? "Advancing..." : "Advance Turn"}
        </button>
      </div>

      {/* Interrupt popup */}
      {interrupt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: 12,
              maxWidth: "400px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Save Required</h3>
            <p>
              <strong>{interrupt.participant_name}</strong> must make a{" "}
              <strong>
                {interrupt.save_ability
                  ? String(interrupt.save_ability).toUpperCase()
                  : "UNKNOWN"}
              </strong>{" "}
              save against <strong>{interrupt.effect_name}</strong>.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => resolveInterrupt(true)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Passed
              </button>
              <button
                type="button"
                onClick={() => resolveInterrupt(false)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Failed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
