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

  // Tarot/Divination color palette
  const colors = {
    deepBlue: "#1a1f3a",
    darkBlue: "#2d3561",
    mediumBlue: "#4a5d8a",
    purple: "#6b46c1",
    lightPurple: "#8b5cf6",
    lavender: "#a78bfa",
    gold: "#d4af37",
    lightGold: "#fbbf24",
    paleGold: "#fcd34d",
    white: "#ffffff",
    lightGray: "#e5e7eb",
    darkGray: "#6b7280",
  };

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

    if (interrupt.notification_only) {
      setInterrupt(null);
      let done = false;
      while (!done) {
        done = await advanceTurnInternal();
      }
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

      setInterrupt(null);
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

  const removeEffect = useCallback(async (effectId) => {
    if (!boot?.campaignId || !boot?.encounterId || !boot?.csrfToken) {
      console.error("CombatConsole: missing boot data for removeEffect");
      return;
    }

    const url = `/campaigns/${boot.campaignId}/encounters/${boot.encounterId}/effects/${effectId}`;

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": boot.csrfToken,
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(`Failed to remove effect: ${response.status}`);
      }

      // Reload state after removing effect
      await loadState();
    } catch (e) {
      console.error("CombatConsole: error removing effect", e);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [boot, loadState]);

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
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg, ${colors.deepBlue} 0%, ${colors.purple} 100%)`,
          padding: "20px 16px",
          color: colors.white,
        }}
      >
        <div
          style={{
            textAlign: "center",
            paddingTop: "40px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: 700,
              color: colors.gold,
              textShadow: `0 2px 8px rgba(212, 175, 55, 0.3)`,
            }}
          >
            Combat Console
          </h1>
          <p
            style={{
              marginTop: "16px",
              fontSize: "clamp(14px, 3vw, 18px)",
              opacity: 0.9,
            }}
          >
            Reading the cards...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg, ${colors.deepBlue} 0%, ${colors.purple} 100%)`,
          padding: "20px 16px",
          color: colors.white,
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto", paddingTop: "40px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: 700,
              color: colors.gold,
              textShadow: `0 2px 8px rgba(212, 175, 55, 0.3)`,
            }}
          >
            Combat Console
          </h1>
          <p
            style={{
              whiteSpace: "pre-wrap",
              marginTop: "16px",
              fontSize: "clamp(14px, 3vw, 16px)",
              opacity: 0.9,
            }}
          >
            Error: {error}
          </p>
          <button
            type="button"
            onClick={loadState}
            style={{
              marginTop: "20px",
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: colors.gold,
              color: colors.deepBlue,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: `0 4px 12px rgba(212, 175, 55, 0.4)`,
              minHeight: "44px",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg, ${colors.deepBlue} 0%, ${colors.purple} 100%)`,
          padding: "20px 16px",
          color: colors.white,
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto", paddingTop: "40px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: 700,
              color: colors.gold,
              textShadow: `0 2px 8px rgba(212, 175, 55, 0.3)`,
            }}
          >
            Combat Console
          </h1>
          <p
            style={{
              marginTop: "16px",
              fontSize: "clamp(14px, 3vw, 16px)",
              opacity: 0.9,
            }}
          >
            No encounter data available
          </p>
          <button
            type="button"
            onClick={loadState}
            style={{
              marginTop: "20px",
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: colors.gold,
              color: colors.deepBlue,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: `0 4px 12px rgba(212, 175, 55, 0.4)`,
              minHeight: "44px",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${colors.deepBlue} 0%, ${colors.purple} 100%)`,
        padding: "16px",
        color: colors.white,
        paddingBottom: "40px",
      }}
    >
      <header
        style={{
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(28px, 6vw, 36px)",
            fontWeight: 700,
            color: colors.gold,
            textShadow: `0 2px 8px rgba(212, 175, 55, 0.3)`,
            letterSpacing: "0.5px",
          }}
        >
          Combat Console
        </h1>
        <div
          style={{
            marginTop: "12px",
            fontSize: "clamp(12px, 3vw, 14px)",
            opacity: 0.85,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "8px 12px",
          }}
        >
          <span>Encounter #{encounter.id}</span>
          <span style={{ color: colors.lavender }}>•</span>
          <span style={{ textTransform: "capitalize" }}>{encounter.status}</span>
          {encounter.round != null && (
            <>
              <span style={{ color: colors.lavender }}>•</span>
              <span>Round {encounter.round}</span>
            </>
          )}
        </div>
      </header>

      <section>
        <h2
          style={{
            margin: "0 0 20px 0",
            fontSize: "clamp(18px, 4vw, 22px)",
            fontWeight: 600,
            color: colors.lavender,
            textAlign: "center",
          }}
        >
          Initiative
        </h2>

        {rotatedParticipants.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              opacity: 0.7,
              backgroundColor: `rgba(107, 70, 193, 0.1)`,
              borderRadius: 12,
              border: `1px solid ${colors.lightPurple}20`,
            }}
          >
            <p style={{ margin: 0, fontSize: "clamp(14px, 3vw, 16px)" }}>
              No participants in this encounter yet.
            </p>
          </div>
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
                    flexDirection: "column",
                    gap: "12px",
                    padding: "16px",
                    marginBottom: "20px",
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${colors.gold}15 0%, ${colors.lightPurple}20 100%)`,
                    border: `2px solid ${colors.gold}`,
                    boxShadow: `0 4px 20px rgba(212, 175, 55, 0.3), 0 0 0 1px ${colors.lightPurple}40`,
                    opacity: p.state && p.state !== "alive" ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flex: "1",
                        minWidth: "200px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "20px",
                          color: colors.gold,
                          fontWeight: 700,
                        }}
                      >
                        ⭐
                      </span>
                      <img
                        src={p.avatar_url || "/default_avatar.png"}
                        alt={p.name}
                        style={{
                          width: "clamp(48px, 10vw, 56px)",
                          height: "clamp(48px, 10vw, 56px)",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: `2px solid ${colors.gold}`,
                          boxShadow: `0 2px 8px rgba(212, 175, 55, 0.4)`,
                        }}
                        onError={(e) => {
                          e.target.src = "/default_avatar.png";
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                        <span
                          style={{
                            fontSize: "clamp(16px, 4vw, 18px)",
                            fontWeight: 600,
                            color: colors.white,
                          }}
                        >
                          {p.name}
                          {p.kind ? (
                            <span style={{ opacity: 0.7, fontSize: "0.9em", marginLeft: "6px" }}>
                              ({p.kind})
                            </span>
                          ) : null}
                          {p.state && p.state !== "alive" ? (
                            <span
                              style={{
                                marginLeft: "8px",
                                opacity: 0.7,
                                fontSize: "0.85em",
                                color: colors.lavender,
                              }}
                            >
                              [{p.state}]
                            </span>
                          ) : null}
                        </span>
                        {p.active_effects && p.active_effects.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              marginTop: 4,
                            }}
                          >
                            {p.active_effects.map((effect, idx) => {
                              const effectName =
                                typeof effect === "string" ? effect : effect.name;
                              const effectId = typeof effect === "string" ? null : effect.id;
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: "clamp(10px, 2.5vw, 12px)",
                                    padding: "4px 8px",
                                    backgroundColor: `${colors.lightPurple}30`,
                                    color: colors.lavender,
                                    borderRadius: 6,
                                    border: `1px solid ${colors.lightPurple}60`,
                                    fontWeight: 500,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  {effectName}
                                  {effectId && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeEffect(effectId);
                                      }}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        color: colors.lavender,
                                        cursor: "pointer",
                                        padding: 0,
                                        margin: 0,
                                        fontSize: "16px",
                                        lineHeight: 1,
                                        opacity: 0.7,
                                        minWidth: "20px",
                                        minHeight: "20px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                      onMouseOver={(e) => {
                                        e.target.style.opacity = "1";
                                        e.target.style.color = colors.gold;
                                      }}
                                      onMouseOut={(e) => {
                                        e.target.style.opacity = "0.7";
                                        e.target.style.color = colors.lavender;
                                      }}
                                      title="Remove effect"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 12px",
                          backgroundColor: `${colors.darkBlue}80`,
                          borderRadius: 8,
                          border: `1px solid ${colors.mediumBlue}60`,
                        }}
                      >
                        <span
                          style={{
                            marginRight: "8px",
                            opacity: 0.7,
                            fontSize: "clamp(12px, 3vw, 14px)",
                          }}
                        >
                          Init
                        </span>
                        <strong
                          style={{
                            fontSize: "clamp(16px, 4vw, 18px)",
                            color: colors.gold,
                          }}
                        >
                          {p.initiative_total ?? "—"}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => markAsDead(p.id)}
                        style={{
                          padding: "10px 16px",
                          fontSize: "clamp(12px, 3vw, 14px)",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                          minHeight: "44px",
                          boxShadow: "0 2px 8px rgba(220, 53, 69, 0.3)",
                          transition: "all 0.2s",
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = "#c82333";
                          e.target.style.transform = "translateY(-1px)";
                          e.target.style.boxShadow = "0 4px 12px rgba(220, 53, 69, 0.4)";
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = "#dc3545";
                          e.target.style.transform = "translateY(0)";
                          e.target.style.boxShadow = "0 2px 8px rgba(220, 53, 69, 0.3)";
                        }}
                      >
                        Kill Combatant
                      </button>
                    </div>
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
                    border: `1px solid ${colors.lightPurple}40`,
                    borderRadius: 16,
                    padding: "12px",
                    backgroundColor: `${colors.darkBlue}40`,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {remaining.map((p, i) => (
                      <li
                        key={p.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          padding: "12px",
                          marginBottom: i < remaining.length - 1 ? "12px" : 0,
                          borderRadius: 12,
                          backgroundColor: `${colors.mediumBlue}20`,
                          border: `1px solid ${colors.lightPurple}30`,
                          opacity: p.state && p.state !== "alive" ? 0.6 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              flex: "1",
                              minWidth: "200px",
                            }}
                          >
                            <span
                              style={{
                                width: "28px",
                                textAlign: "center",
                                fontSize: "clamp(14px, 3vw, 16px)",
                                color: colors.lavender,
                                fontWeight: 600,
                                opacity: 0.8,
                              }}
                            >
                              {i + (encounter.active_participant_id ? 2 : 1)}
                            </span>
                            <img
                              src={p.avatar_url || "/default_avatar.png"}
                              alt={p.name}
                              style={{
                                width: "clamp(40px, 8vw, 48px)",
                                height: "clamp(40px, 8vw, 48px)",
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: `2px solid ${colors.lightPurple}60`,
                                boxShadow: `0 2px 6px rgba(139, 92, 246, 0.3)`,
                              }}
                              onError={(e) => {
                                e.target.src = "/default_avatar.png";
                              }}
                            />
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                flex: 1,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "clamp(14px, 3.5vw, 16px)",
                                  fontWeight: 500,
                                  color: colors.white,
                                }}
                              >
                                {p.name}
                                {p.kind ? (
                                  <span
                                    style={{
                                      opacity: 0.7,
                                      fontSize: "0.9em",
                                      marginLeft: "6px",
                                    }}
                                  >
                                    ({p.kind})
                                  </span>
                                ) : null}
                                {p.state && p.state !== "alive" ? (
                                  <span
                                    style={{
                                      marginLeft: "8px",
                                      opacity: 0.7,
                                      fontSize: "0.85em",
                                      color: colors.lavender,
                                    }}
                                  >
                                    [{p.state}]
                                  </span>
                                ) : null}
                              </span>
                              {p.active_effects && p.active_effects.length > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 6,
                                    marginTop: 4,
                                  }}
                                >
                                  {p.active_effects.map((effect, idx) => {
                                    const effectName =
                                      typeof effect === "string" ? effect : effect.name;
                                    const effectId =
                                      typeof effect === "string" ? null : effect.id;
                                    return (
                                      <span
                                        key={idx}
                                        style={{
                                          fontSize: "clamp(10px, 2.5vw, 12px)",
                                          padding: "4px 8px",
                                          backgroundColor: `${colors.lightPurple}30`,
                                          color: colors.lavender,
                                          borderRadius: 6,
                                          border: `1px solid ${colors.lightPurple}60`,
                                          fontWeight: 500,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        {effectName}
                                        {effectId && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeEffect(effectId);
                                            }}
                                            style={{
                                              background: "none",
                                              border: "none",
                                              color: colors.lavender,
                                              cursor: "pointer",
                                              padding: 0,
                                              margin: 0,
                                              fontSize: "16px",
                                              lineHeight: 1,
                                              opacity: 0.7,
                                              minWidth: "20px",
                                              minHeight: "20px",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                            }}
                                            onMouseOver={(e) => {
                                              e.target.style.opacity = "1";
                                              e.target.style.color = colors.gold;
                                            }}
                                            onMouseOut={(e) => {
                                              e.target.style.opacity = "0.7";
                                              e.target.style.color = colors.lavender;
                                            }}
                                            title="Remove effect"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                padding: "6px 10px",
                                backgroundColor: `${colors.darkBlue}80`,
                                borderRadius: 8,
                                border: `1px solid ${colors.mediumBlue}60`,
                              }}
                            >
                              <span
                                style={{
                                  marginRight: "6px",
                                  opacity: 0.7,
                                  fontSize: "clamp(11px, 2.5vw, 13px)",
                                }}
                              >
                                Init
                              </span>
                              <strong
                                style={{
                                  fontSize: "clamp(14px, 3.5vw, 16px)",
                                  color: colors.gold,
                                }}
                              >
                                {p.initiative_total ?? "—"}
                              </strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => markAsDead(p.id)}
                              style={{
                                padding: "8px 14px",
                                fontSize: "clamp(11px, 2.5vw, 13px)",
                                backgroundColor: "#dc3545",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                cursor: "pointer",
                                fontWeight: 600,
                                minHeight: "44px",
                                boxShadow: "0 2px 8px rgba(220, 53, 69, 0.3)",
                                transition: "all 0.2s",
                              }}
                              onMouseOver={(e) => {
                                e.target.style.backgroundColor = "#c82333";
                                e.target.style.transform = "translateY(-1px)";
                                e.target.style.boxShadow =
                                  "0 4px 12px rgba(220, 53, 69, 0.4)";
                              }}
                              onMouseOut={(e) => {
                                e.target.style.backgroundColor = "#dc3545";
                                e.target.style.transform = "translateY(0)";
                                e.target.style.boxShadow =
                                  "0 2px 8px rgba(220, 53, 69, 0.3)";
                              }}
                            >
                              Kill
                            </button>
                          </div>
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
        <section style={{ marginTop: "32px" }}>
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "clamp(16px, 3.5vw, 18px)",
              fontWeight: 600,
              color: colors.darkGray,
              textAlign: "center",
              opacity: 0.7,
            }}
          >
            Dead Combatants
          </h2>
          <div
            style={{
              border: `1px solid ${colors.darkGray}40`,
              borderRadius: 16,
              padding: "12px",
              backgroundColor: `${colors.darkBlue}30`,
              opacity: 0.7,
            }}
          >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {deadParticipants.map((p, i) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    marginBottom: i < deadParticipants.length - 1 ? "10px" : 0,
                    borderRadius: 12,
                    color: colors.darkGray,
                  }}
                >
                  <img
                    src={p.avatar_url || "/default_avatar.png"}
                    alt={p.name}
                    style={{
                      width: "clamp(36px, 7vw, 44px)",
                      height: "clamp(36px, 7vw, 44px)",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: `1px solid ${colors.darkGray}40`,
                      opacity: 0.6,
                    }}
                    onError={(e) => {
                      e.target.src = "/default_avatar.png";
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "clamp(13px, 3vw, 15px)",
                        fontWeight: 500,
                      }}
                    >
                      {p.name}
                    </span>
                    {p.kind ? (
                      <span
                        style={{
                          opacity: 0.5,
                          fontSize: "clamp(11px, 2.5vw, 13px)",
                        }}
                      >
                        ({p.kind})
                      </span>
                    ) : null}
                    {p.active_effects && p.active_effects.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 4,
                        }}
                      >
                        {p.active_effects.map((effect, idx) => {
                          const effectName =
                            typeof effect === "string" ? effect : effect.name;
                          const effectId = typeof effect === "string" ? null : effect.id;
                          return (
                            <span
                              key={idx}
                              style={{
                                fontSize: "clamp(9px, 2vw, 11px)",
                                padding: "3px 7px",
                                backgroundColor: `${colors.lightPurple}20`,
                                color: colors.lavender,
                                borderRadius: 5,
                                border: `1px solid ${colors.lightPurple}40`,
                                fontWeight: 500,
                                opacity: 0.8,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              {effectName}
                              {effectId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeEffect(effectId);
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: colors.lavender,
                                    cursor: "pointer",
                                    padding: 0,
                                    margin: 0,
                                    fontSize: "14px",
                                    lineHeight: 1,
                                    opacity: 0.7,
                                    minWidth: "18px",
                                    minHeight: "18px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                  onMouseOver={(e) => {
                                    e.target.style.opacity = "1";
                                    e.target.style.color = colors.gold;
                                  }}
                                  onMouseOut={(e) => {
                                    e.target.style.opacity = "0.7";
                                    e.target.style.color = colors.lavender;
                                  }}
                                  title="Remove effect"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Advance Turn button */}
      <div
        style={{
          marginTop: "32px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={advanceTurn}
          disabled={advancing || encounter.status !== "active"}
          style={{
            padding: "16px 32px",
            fontSize: "clamp(16px, 4vw, 18px)",
            backgroundColor:
              advancing || encounter.status !== "active"
                ? colors.darkGray
                : colors.gold,
            color:
              advancing || encounter.status !== "active"
                ? colors.lightGray
                : colors.deepBlue,
            border: "none",
            borderRadius: 12,
            cursor:
              advancing || encounter.status !== "active"
                ? "not-allowed"
                : "pointer",
            fontWeight: 700,
            minHeight: "56px",
            minWidth: "200px",
            boxShadow:
              advancing || encounter.status !== "active"
                ? "none"
                : `0 4px 20px rgba(212, 175, 55, 0.4)`,
            transition: "all 0.3s",
            letterSpacing: "0.5px",
          }}
          onMouseOver={(e) => {
            if (!advancing && encounter.status === "active") {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = `0 6px 24px rgba(212, 175, 55, 0.5)`;
            }
          }}
          onMouseOut={(e) => {
            if (!advancing && encounter.status === "active") {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = `0 4px 20px rgba(212, 175, 55, 0.4)`;
            }
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
            backgroundColor: "rgba(26, 31, 58, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${colors.darkBlue} 0%, ${colors.purple} 100%)`,
              padding: "clamp(20px, 5vw, 32px)",
              borderRadius: 20,
              maxWidth: "min(90vw, 500px)",
              width: "100%",
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 2px ${colors.gold}40`,
              border: `2px solid ${colors.gold}60`,
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "16px",
                fontSize: "clamp(20px, 4.5vw, 24px)",
                fontWeight: 700,
                color: colors.gold,
                textShadow: `0 2px 8px rgba(212, 175, 55, 0.3)`,
                textAlign: "center",
              }}
            >
              {interrupt.notification_only ? "Effect Active" : "Save Required"}
            </h3>
            <p
              style={{
                fontSize: "clamp(14px, 3.5vw, 16px)",
                lineHeight: 1.6,
                color: colors.white,
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              {interrupt.notification_only ? (
                <>
                  <strong style={{ color: colors.lavender }}>{interrupt.participant_name}</strong> is
                  affected by <strong style={{ color: colors.lavender }}>{interrupt.effect_name}</strong>.
                </>
              ) : (
                <>
                  <strong style={{ color: colors.lavender }}>{interrupt.participant_name}</strong> must
                  make a{" "}
                  <strong style={{ color: colors.gold }}>
                    {interrupt.save_ability
                      ? String(interrupt.save_ability).toUpperCase()
                      : "UNKNOWN"}
                  </strong>{" "}
                  save against <strong style={{ color: colors.lavender }}>{interrupt.effect_name}</strong>.
                </>
              )}
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "24px",
                flexWrap: "wrap",
              }}
            >
              {interrupt.notification_only ? (
                <button
                  type="button"
                  onClick={() => resolveInterrupt(null)}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    fontSize: "clamp(14px, 3.5vw, 16px)",
                    backgroundColor: colors.gold,
                    color: colors.deepBlue,
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                    minHeight: "48px",
                    boxShadow: `0 4px 20px rgba(212, 175, 55, 0.4)`,
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = colors.lightGold;
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = `0 6px 24px rgba(212, 175, 55, 0.5)`;
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = colors.gold;
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = `0 4px 20px rgba(212, 175, 55, 0.4)`;
                  }}
                >
                  OK
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => resolveInterrupt(true)}
                    style={{
                      flex: 1,
                      minWidth: "120px",
                      padding: "14px 20px",
                      fontSize: "clamp(14px, 3.5vw, 16px)",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      cursor: "pointer",
                      fontWeight: 600,
                      minHeight: "48px",
                      boxShadow: "0 4px 12px rgba(40, 167, 69, 0.3)",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "#218838";
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 6px 16px rgba(40, 167, 69, 0.4)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "#28a745";
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 4px 12px rgba(40, 167, 69, 0.3)";
                    }}
                  >
                    Passed
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveInterrupt(false)}
                    style={{
                      flex: 1,
                      minWidth: "120px",
                      padding: "14px 20px",
                      fontSize: "clamp(14px, 3.5vw, 16px)",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      cursor: "pointer",
                      fontWeight: 600,
                      minHeight: "48px",
                      boxShadow: "0 4px 12px rgba(220, 53, 69, 0.3)",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "#c82333";
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 6px 16px rgba(220, 53, 69, 0.4)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "#dc3545";
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 4px 12px rgba(220, 53, 69, 0.3)";
                    }}
                  >
                    Failed
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
