import React from "react";
import { createRoot } from "react-dom/client";
import CombatConsole from "../../components/CombatConsole";  

function readBootData(rootEl) {
  const { campaignId, encounterId, csrfToken } = rootEl.dataset;

  // Basic sanity: these come in as strings
  return {
    campaignId: Number(campaignId),
    encounterId: Number(encounterId),
    csrfToken,
  };
}

function mount() {
  const rootEl = document.getElementById("combat-console-root");
  if (!rootEl) {
    console.warn("CombatConsole: root element not found");
    return;
  }

  try {
    const boot = readBootData(rootEl);
    console.log("CombatConsole: mounting with boot data", boot);

    createRoot(rootEl).render(<CombatConsole boot={boot} />);
  } catch (error) {
    console.error("CombatConsole: error mounting", error);
    rootEl.innerHTML = `<p style="color: red;">Error loading combat console: ${error.message}</p>`;
  }
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
