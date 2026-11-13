import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./store/StoreContext";
import { OpsProvider } from "./platform/OpsContext";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <OpsProvider>
        <App />
      </OpsProvider>
    </StoreProvider>
  </React.StrictMode>
);
