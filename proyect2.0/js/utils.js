// js/utils.js
// utils.js

export function formatearFecha(fecha) {
  if (!fecha) return "";
  const f = new Date(fecha);
  if (isNaN(f)) return fecha; // si no es una fecha válida, la devuelve tal cual
  return f.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Si tienes otras utilidades, asegúrate de exportarlas también, por ejemplo:
export function mostrarMensaje(texto, tipo = "info") {
  const div = document.createElement("div");
  div.className = `mensaje ${tipo}`;
  div.textContent = texto;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// js/utils.js
export async function cargarModulo(idModulo) {
  const seccion = document.getElementById(idModulo);
  if (!seccion) return;

  // Detecta si estás en /admin/, /residente/ o /comite/
  const baseRuta = window.location.pathname.includes("/admin/") ||
                   window.location.pathname.includes("/residente/") ||
                   window.location.pathname.includes("/comite/")
    ? "../modules/"
    : "./modules/";

  const mapa = {
    modPerfil: `${baseRuta}perfil.js`,
    modPagos: `${baseRuta}pagos.js`,
    modSolicitudes: `${baseRuta}solicitudes.js`,
    modReservas: `${baseRuta}reservas.js`,
    modCertificados: `${baseRuta}certificados.js`,
    modMensajes: `${baseRuta}mensajes.js`,
    modSeguimiento: `${baseRuta}seguimiento.js`,
  };

  const archivo = mapa[idModulo];
  if (!archivo) {
    seccion.innerHTML = "<p>Módulo no encontrado.</p>";
    return;
  }

  try {
    seccion.innerHTML = "<p>Cargando módulo...</p>";
    const modulo = await import(archivo);
    seccion.innerHTML = "";
    modulo.render(seccion);
  } catch (error) {
    seccion.innerHTML = `<p>Error al cargar el módulo: ${error.message}</p>`;
    console.error("Error al cargar el módulo:", error);
  }
}




