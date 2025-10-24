import { supabase } from "../js/supabaseClient.js";
import { verificarSesion } from "../js/auth.js";

await verificarSesion(["administrador", "residente", "comite"]);

const usuario = JSON.parse(localStorage.getItem("usuario"));

export async function render(contenedor) {
  contenedor.innerHTML = `
  <h2 class="tituloModulo">Pagos</h2>
  ${
    usuario.rol !== "administrador"
      ? `
      <div class="infoPago" style="
        background:#eef7ff;
        padding:10px;
        border-radius:8px;
        margin-bottom:15px;
        font-size:0.95rem;
        ">
        💳 <strong>Datos para consignación:</strong><br>
        Cuenta de ahorros: <strong>123-456-789</strong><br>
        Referencia: <em>número de apartamento o cédula</em>
      </div>
    `
      : `
      <div class="filtrosAdmin" style="margin-bottom:15px;">
        <input type="text" id="filtroNombre" placeholder="Buscar por nombre..." class="inputFiltro" />
        <select id="filtroEstado" class="inputFiltro">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
        </select>
      </div>
    `
  }
  <div id="contenedorPagos" class="tablaPagos"></div>
  <div id="formPagoContainer" class="formContainer hidden"></div>
`;

  // Cargar pagos iniciales
  await cargarPagos();

  // Si es admin, activar filtros automáticos
  if (usuario.rol === "administrador") {
    const nombreInput = document.getElementById("filtroNombre");
    const estadoSelect = document.getElementById("filtroEstado");

    let temporizador;
    nombreInput.addEventListener("input", () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => cargarPagos(), 400);
    });

    estadoSelect.addEventListener("change", () => cargarPagos());
  }
}

/** ───────────────────────────────
 * Función principal de carga
 * ───────────────────────────────*/
async function cargarPagos() {
  const pagosDiv = document.getElementById("contenedorPagos");
  pagosDiv.innerHTML = "<p>Cargando pagos...</p>";

  let query = supabase.from("pagos").select(`
    id, monto, fecha_pago, descripcion, soporte_url, estado, mes_correspondiente, usuario_id,
    usuarios (id, nombre, correo)
  `);

  if (usuario.rol !== "administrador") {
    query = query.eq("usuario_id", usuario.id);
  } else {
    const filtroNombre = document.getElementById("filtroNombre")?.value?.toLowerCase() || "";
    const filtroEstado = document.getElementById("filtroEstado")?.value || "";

    if (filtroEstado) {
      query = query.eq("estado", filtroEstado);
    }

    const { data: pagosRaw, error } = await query.order("fecha_pago", { ascending: false });
    if (error) {
      console.error("Error cargando pagos:", error);
      pagosDiv.innerHTML = "<p>Error cargando pagos.</p>";
      return;
    }

    let pagos = pagosRaw;
    if (filtroNombre) {
      pagos = pagos.filter((p) =>
        p.usuarios?.nombre?.toLowerCase().includes(filtroNombre)
      );
    }
    renderTabla(pagosDiv, pagos);
    return;
  }

  const { data: pagos, error } = await query.order("fecha_pago", { ascending: false });
  if (error) {
    console.error("Error cargando pagos:", error);
    pagosDiv.innerHTML = "<p>Error cargando pagos.</p>";
    return;
  }

  renderTabla(pagosDiv, pagos);
}

/** ───────────────────────────────
 * Renderiza la tabla de pagos
 * ───────────────────────────────*/
function renderTabla(pagosDiv, pagos) {
  if (!pagos || pagos.length === 0) {
    pagosDiv.innerHTML = "<p>No hay pagos registrados.</p>";
    if (usuario.rol !== "administrador") {
      pagosDiv.innerHTML += `
        <div style="margin-top: 20px;">
          <button id="btnNuevoPago" class="btnPrimario">Registrar nuevo pago</button>
        </div>
      `;
      document
        .getElementById("btnNuevoPago")
        .addEventListener("click", mostrarFormularioPago);
    }
    return;
  }

  let tablaHTML = `
    <table class="tablaEstilo">
      <thead>
        <tr>
          ${usuario.rol === "administrador" ? "<th>Usuario</th>" : ""}
          <th>Fecha</th>
          <th>Mes</th>
          <th>Monto</th>
          <th>Descripción</th>
          <th>Soporte</th>
          <th>Estado</th>
          ${usuario.rol === "administrador" ? "<th>Acciones</th><th>Situación</th>" : ""}
        </tr>
      </thead>
      <tbody>
  `;

  pagos.forEach((pago) => {
    tablaHTML += `
      <tr>
        ${usuario.rol === "administrador" ? `<td>${pago.usuarios?.nombre || "—"}</td>` : ""}
        <td>${pago.fecha_pago}</td>
        <td>${pago.mes_correspondiente || "—"}</td>
        <td>$${Number(pago.monto).toLocaleString()}</td>
        <td>${pago.descripcion || "—"}</td>
        <td>${pago.soporte_url ? `<a href="${pago.soporte_url}" target="_blank">Ver</a>` : "—"}</td>
        <td>${pago.estado}</td>
        ${
          usuario.rol === "administrador"
            ? `
            <td>
              <button class="btnAprobar" data-id="${pago.id}">✔️</button>
              <button class="btnRechazar" data-id="${pago.id}">❌</button>
            </td>
            <td id="situacion-${pago.id}">⏳ Verificando...</td>
          `
            : ""
        }
      </tr>
    `;
  });

  tablaHTML += `</tbody></table>`;

  if (usuario.rol !== "administrador") {
    tablaHTML += `
      <div style="margin-top: 20px;">
        <button id="btnNuevoPago" class="btnPrimario">Registrar nuevo pago</button>
      </div>
    `;
  }

  pagosDiv.innerHTML = tablaHTML;

  if (usuario.rol === "administrador") {
    document.querySelectorAll(".btnAprobar").forEach((b) =>
      b.addEventListener("click", () => actualizarEstadoPago(b.dataset.id, "aprobado"))
    );
    document.querySelectorAll(".btnRechazar").forEach((b) =>
      b.addEventListener("click", () => actualizarEstadoPago(b.dataset.id, "rechazado"))
    );

    pagos.forEach(async (p) => {
      const estaAlDia = await verificarSiEstaAlDia(p.usuarios?.id || p.usuario_id);
      const celda = document.getElementById(`situacion-${p.id}`);
      if (celda) {
        celda.textContent = estaAlDia ? "✅ Al día" : "⚠️ Pendiente";
        celda.style.color = estaAlDia ? "green" : "orange";
      }
    });
  }

  if (usuario.rol !== "administrador") {
    document.getElementById("btnNuevoPago").addEventListener("click", mostrarFormularioPago);
  }
}

/** ───────────────────────────────
 * Formulario de registro de pago
 * ───────────────────────────────*/
function mostrarFormularioPago() {
  const formContainer = document.getElementById("formPagoContainer");
  formContainer.classList.remove("hidden");

  formContainer.innerHTML = `
    <h3>Registrar nuevo pago</h3>
    <form id="formPago" class="formPago">
      <label>Monto:</label>
      <input type="number" id="monto" required placeholder="Ej: 150000" />

      <label>Fecha de pago:</label>
      <input type="date" id="fecha_pago" required />

      <label>Mes correspondiente:</label>
      <input type="month" id="mes_correspondiente" required />

      <label>Descripción:</label>
      <input type="text" id="descripcion" placeholder="Ej: cuota de administración marzo" />

      <label>Soporte de pago (imagen o PDF):</label>
      <input type="file" id="soporte" accept="image/*,.pdf" required />

      <div class="accionesForm">
        <button type="submit" class="btnPrimario">Guardar pago</button>
        <button type="button" id="cancelar" class="btnSecundario">Cancelar</button>
      </div>
    </form>
  `;

  document.getElementById("cancelar").addEventListener("click", () => {
    formContainer.classList.add("hidden");
    formContainer.innerHTML = "";
  });

  document.getElementById("formPago").addEventListener("submit", async (e) => {
    e.preventDefault();

    const monto = document.getElementById("monto").value;
    const fecha_pago = document.getElementById("fecha_pago").value;
    const mes_correspondiente = document.getElementById("mes_correspondiente").value;
    const descripcion = document.getElementById("descripcion").value;
    const archivo = document.getElementById("soporte").files[0];

    if (!archivo) {
      alert("Por favor, sube el soporte del pago.");
      return;
    }

    const nombreArchivo = `${usuario.id}_${Date.now()}_${archivo.name}`;
    const { error: errorUpload } = await supabase.storage
      .from("soportes")
      .upload(nombreArchivo, archivo);

    if (errorUpload) {
      console.error("Error subiendo archivo:", errorUpload);
      alert("No se pudo subir el soporte.");
      return;
    }

    const { data: publicURLData } = supabase.storage
      .from("soportes")
      .getPublicUrl(nombreArchivo);
    const soporte_url = publicURLData.publicUrl;

    const { error: errorInsert } = await supabase.from("pagos").insert([
      {
        usuario_id: usuario.id,
        monto,
        fecha_pago,
        mes_correspondiente,
        descripcion,
        soporte_url,
        estado: "pendiente",
      },
    ]);

    if (errorInsert) {
      console.error("Error guardando pago:", errorInsert);
      alert("Hubo un error al guardar el pago.");
      return;
    }

    alert("Pago registrado correctamente. Quedará pendiente de aprobación.");
    formContainer.classList.add("hidden");
    formContainer.innerHTML = "";
    cargarPagos();
  });
}

/** ───────────────────────────────
 * Cambiar estado del pago (solo admin)
 * ───────────────────────────────*/
async function actualizarEstadoPago(id, nuevoEstado) {
  if (!confirm(`¿Seguro que deseas marcar este pago como "${nuevoEstado}"?`)) {
    return;
  }

  const { error } = await supabase
    .from("pagos")
    .update({ estado: nuevoEstado })
    .eq("id", id);

  if (error) {
    console.error("Error actualizando estado:", error);
    alert("No se pudo actualizar el estado del pago.");
    return;
  }

  alert(`Pago marcado como ${nuevoEstado}.`);
  cargarPagos();
}

/** ───────────────────────────────
 * Verificar si el usuario está al día
 * ───────────────────────────────*/
async function verificarSiEstaAlDia(usuario_id) {
  const mesActual = new Date().toISOString().slice(0, 7); // formato YYYY-MM
  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("usuario_id", usuario_id)
    .eq("estado", "aprobado")
    .eq("mes_correspondiente", mesActual);

  if (error) {
    console.error("Error verificando estado de pago:", error);
    return false;
  }
  return data && data.length > 0;
}
