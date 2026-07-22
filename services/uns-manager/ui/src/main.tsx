import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./app/App";
import { applyDensity, applyTheme, resolveInitialDensity, resolveInitialTheme } from "./shared/ui/theme";
import { ToastProvider } from "./shared/ui/ToastProvider";
import "./styles.css";

const queryClient = new QueryClient();

applyTheme(resolveInitialTheme());
applyDensity(resolveInitialDensity());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
