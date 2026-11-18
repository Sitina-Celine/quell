import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Sales from "./pages/Sales.jsx";
import "./styles/base.css";
import "./styles/sales.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Sales />
  </StrictMode>
);
