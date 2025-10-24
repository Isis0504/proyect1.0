// js/main.js
import { mostrarMensaje } from "./utils.js";

export function initDashboard(rol) {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  if (usuario) {
    document.getElementById("nombreUsuario").textContent = usuario.nombre;
    mostrarMensaje(`Panel de ${rol}`, "info");
  }
}
