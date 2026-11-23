import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { StoreProvider } from "./state/store";

// De preview (gepubliceerd als claude.ai-pagina) kan geen URL-paden gebruiken: navigatie blijft in de pagina.
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <StoreProvider>
        <App />
      </StoreProvider>
    </Router>
  </StrictMode>,
);

// Installeerbare app: service worker alleen in de echte productieversie.
if (import.meta.env.PROD && !import.meta.env.VITE_PREVIEW && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* geen offline-modus; app werkt gewoon */ });
  });
}
