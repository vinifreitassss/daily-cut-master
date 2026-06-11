import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./photo.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Elemento #root não encontrado");
}

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
