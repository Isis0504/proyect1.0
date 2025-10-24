import { verificarSesion } from "../js/auth.js";
import { cargarModulo } from "../js/utils.js";

verificarSesion(["residente"]);

const usuario = JSON.parse(localStorage.getItem("usuario"));
document.getElementById("nombreUsuario").textContent = usuario?.nombre || "Residente";

const mainTabs = document.getElementById("mainTabs");

const botones = [
  { id: "modPerfil", nombre: "Mi Perfil" },
  { id: "modPagos", nombre: "Mis Pagos" },
  { id: "modSolicitudes", nombre: "Solicitudes" },
  { id: "modReservas", nombre: "Reservas" },
  { id: "modCertificados", nombre: "Certificados" },
  { id: "modMensajes", nombre: "Comunicaciones" },
  { id: "logout", nombre: "Cerrar Sesión" },
];

mainTabs.innerHTML = botones
  .map((b) => {
    const extraClass = b.id === "logout" ? "logoutBtn" : "";
    return `<button class="tabBtn ${extraClass}" data-id="${b.id}">${b.nombre}</button>`;
  })
  .join("");

document.querySelectorAll(".tabBtn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const id = btn.dataset.id;

    if (id === "logout") {
      localStorage.removeItem("usuario");
      window.location.href = "../login.html";
      return;
    }

    document.querySelectorAll(".module").forEach((m) => m.classList.add("hidden"));
    const seccion = document.getElementById(id);
    seccion.classList.remove("hidden");

    await cargarModulo(id);
  });
});
