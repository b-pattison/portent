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

let rootInstance = null;

function mount() {
  const rootEl = document.getElementById("combat-console-root");
  if (!rootEl) {
    console.warn("CombatConsole: root element not found");
    return;
  }

  // If we already have a root instance, unmount it first
  if (rootInstance) {
    try {
      rootInstance.unmount();
      rootInstance = null;
    } catch (e) {
      console.warn("CombatConsole: error unmounting previous instance", e);
    }
  }

  try {
    const boot = readBootData(rootEl);
    console.log("CombatConsole: mounting with boot data", boot);

    rootInstance = createRoot(rootEl);
    rootInstance.render(<CombatConsole boot={boot} />);
  } catch (error) {
    console.error("CombatConsole: error mounting", error);
    rootEl.innerHTML = `<p style="color: red;">Error loading combat console: ${error.message}</p>`;
  }
}

function tryMount() {
  // Only mount if we're on a page with the combat console
  if (document.getElementById("combat-console-root")) {
    mount();
  }
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tryMount);
} else {
  tryMount();
}

// Also mount on Turbo navigation events
document.addEventListener("turbo:load", tryMount);
document.addEventListener("turbo:frame-load", tryMount);
