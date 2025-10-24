// modules/reservas.js
import { supabase } from "../js/supabaseClient.js";
import { verificarSesion } from "../js/auth.js";
import { mostrarMensaje } from "../js/utils.js";

const AREAS = ["Salón social", "Parqueadero social", "Piscina", "Gimnasio"];

export async function render(contenedor) {
  await verificarSesion(["administrador", "residente", "comite"]);
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  contenedor.innerHTML = `
    <h2 class="tituloModulo">Reservas</h2>

    <div class="reserva-controls" style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
      <div>
        <label>Mes:</label>
        <button id="mesPrev" class="btnSecundario">◀</button>
        <span id="mesLabel" style="margin:0 8px;font-weight:600;"></span>
        <button id="mesNext" class="btnSecundario">▶</button>
      </div>
      <div style="margin-left:auto;">
        ${usuario.rol !== "administrador" ? `<button id="btnNuevaReserva" class="btnPrimario">Nueva reserva</button>` : ""}
      </div>
    </div>

    <div id="calendarioReservas" style="margin-bottom:20px;"></div>

    ${
      usuario.rol === "administrador"
        ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <input id="buscarReserva" type="text" placeholder="Buscar por nombre o área..."
            style="flex:2;padding:10px 12px;font-size:14px;border:1px solid #ccc;border-radius:6px;margin-right:10px;"/>
          <select id="filtroEstado" style="flex:1;padding:10px;font-size:14px;border-radius:6px;">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Ocupado</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>`
        : ""
    }

    <div id="listaReservas"></div>

    <div id="modalReserva" class="hidden"></div>

    <style>
      /* Colores del calendario */
      .libre {
        background-color: #e6f4ff;
        border: 1px solid #90caf9;
      }
      .pendiente {
        background-color: #fff3e0;
        border: 1px solid #ffb84d;
      }
      .ocupado {
        background-color: #fdecea;
        border: 1px solid #f5c6cb;
      }
      .rechazada {
        background-color: #e3e9ff;
        border: 1px solid #9ea8ff;
      }
      .tablaEstilo th, .tablaEstilo td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid #eee;
      }
      .tablaEstilo th {
        background-color: #f5f5f5;
      }
    </style>
  `;

  const hoy = new Date();
  let visibleYear = hoy.getFullYear();
  let visibleMonth = hoy.getMonth();

  document.getElementById("mesPrev").addEventListener("click", () => {
    visibleMonth--;
    if (visibleMonth < 0) {
      visibleMonth = 11;
      visibleYear--;
    }
    actualizar();
  });
  document.getElementById("mesNext").addEventListener("click", () => {
    visibleMonth++;
    if (visibleMonth > 11) {
      visibleMonth = 0;
      visibleYear++;
    }
    actualizar();
  });

  const btnNueva = document.getElementById("btnNuevaReserva");
  if (btnNueva) btnNueva.addEventListener("click", () => abrirFormularioReserva());

  await actualizar();

  async function actualizar() {
    document.getElementById("mesLabel").textContent = `${visibleYear} - ${String(visibleMonth + 1).padStart(2, "0")}`;
    await cargarYRenderReservas(visibleYear, visibleMonth);
  }

  async function cargarYRenderReservas(year, month) {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    const inicio = new Date(year, month, 1).toISOString();
    const fin = new Date(year, month + 1, 1).toISOString();

    const { data: todas, error } = await supabase
      .from("reservas")
      .select(`
        id, usuario_id, nombre_area, fecha, hora_inicio, hora_fin, estado, motivo, creado_en,
        usuarios:usuario_id (nombre)
      `)
      .gte("fecha", inicio)
      .lt("fecha", fin)
      .order("fecha", { ascending: true });

    if (error) {
      console.error("Error cargando reservas:", error);
      mostrarMensaje("Error cargando reservas", "error");
      return;
    }

    const propias = usuario.rol === "administrador"
      ? todas
      : (todas || []).filter(r => r.usuario_id === usuario.id);

    renderCalendario(year, month, todas || []);
    renderListaReservas(propias || [], usuario.rol);
  }

  function renderCalendario(year, month, reservas) {
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const diasPorFecha = {};

    reservas.forEach(r => {
      const fechaISO = new Date(r.fecha).toISOString().slice(0, 10);
      diasPorFecha[fechaISO] = diasPorFecha[fechaISO] || [];
      diasPorFecha[fechaISO].push(r);
    });

    let html = `<div style="display:flex;gap:8px;align-items:flex-start;">
      <div style="flex:0 0 220px;">`;

    html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;margin-bottom:6px;font-weight:700;">
      ${["D","L","M","M","J","V","S"].map(d => `<div>${d}</div>`).join("")}
    </div>`;

    html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">`;

    for (let i = 0; i < startDay; i++) html += `<div style="min-height:50px;"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const fechaISO = new Date(year, month, d).toISOString().slice(0, 10);
      const reservasDia = diasPorFecha[fechaISO] || [];

      let clase = "libre";
      if (reservasDia.some(r => r.estado === "pendiente")) clase = "pendiente";
      else if (reservasDia.some(r => r.estado === "aprobada")) clase = "ocupado";
      else if (reservasDia.some(r => r.estado === "rechazada")) clase = "rechazada";

      const detalles = reservasDia.map(r =>
        `<div style="font-size:11px;">
          <strong>${r.nombre_area}</strong><br>
          ${r.hora_inicio?.slice(0,5) || "-"}-${r.hora_fin?.slice(0,5) || "-"} (${r.usuarios?.nombre || "—"})
        </div>`
      ).join("");

      html += `
        <div class="${clase}" data-fecha="${fechaISO}" style="min-height:70px;padding:6px;border-radius:6px;cursor:pointer;">
          <div style="font-weight:600;margin-bottom:4px;">${d}</div>
          ${detalles}
        </div>
      `;
    }

    html += `</div></div>
      <div style="flex:1;padding-left:20px;">
        <strong>Leyenda:</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
          <div style="background:#e6f4ff;border:1px solid #90caf9;padding:4px 8px;border-radius:6px;">Libre</div>
          <div style="background:#fff3e0;border:1px solid #ffb84d;padding:4px 8px;border-radius:6px;">Pendiente</div>
          <div style="background:#fdecea;border:1px solid #f5c6cb;padding:4px 8px;border-radius:6px;">Ocupado</div>
          <div style="background:#e3e9ff;border:1px solid #9ea8ff;padding:4px 8px;border-radius:6px;">Rechazada</div>
        </div>
        <div id="resumenDia" style="margin-top:12px;"></div>
      </div>
    </div>`;

    const calendario = document.getElementById("calendarioReservas");
    calendario.innerHTML = html;

    calendario.querySelectorAll("[data-fecha]").forEach(el => {
      el.addEventListener("click", () => {
        const fecha = el.getAttribute("data-fecha");
        const reservasDelDia = reservas.filter(r => new Date(r.fecha).toISOString().slice(0,10) === fecha);
        const resumenDiv = document.getElementById("resumenDia");

        resumenDiv.innerHTML = reservasDelDia.length === 0
          ? `<p><strong>${fecha}</strong>: sin reservas.</p>`
          : `<h4>Reservas del ${fecha}</h4>${reservasDelDia.map(r => `
            <div style="padding:6px;border-bottom:1px solid #eee;">
              <strong>${r.nombre_area}</strong> (${r.hora_inicio?.slice(0,5)} - ${r.hora_fin?.slice(0,5)})<br>
              Estado: <strong>${r.estado === "aprobada" ? "Ocupado" : r.estado}</strong><br>
              Solicitante: ${r.usuarios?.nombre || "—"}
            </div>`).join("")}`;
      });
    });
  }

  function renderListaReservas(reservas, rol) {
    const lista = document.getElementById("listaReservas");
    if (!reservas || reservas.length === 0) {
      lista.innerHTML = "<p>No se encontraron reservas.</p>";
      return;
    }

    const filtroEstado = document.getElementById("filtroEstado");
    const buscarInput = document.getElementById("buscarReserva");

    function filtrarYRender() {
      const estadoSel = (filtroEstado?.value || "").toLowerCase();
      const texto = (buscarInput?.value || "").toLowerCase();

      const filtradas = reservas.filter(r => {
        const coincideTexto = r.nombre_area.toLowerCase().includes(texto) ||
                              r.usuarios?.nombre?.toLowerCase().includes(texto);
        const coincideEstado = !estadoSel || r.estado.toLowerCase() === estadoSel;
        return coincideTexto && coincideEstado;
      });

      lista.innerHTML = `
        <table class="tablaEstilo" style="width:100%">
          <thead>
            <tr>
              <th>Área</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Solicitante</th>
              <th>Estado</th>
              <th>Motivo</th>
              ${rol === "administrador" ? "<th>Acciones</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${filtradas.map(r => `
              <tr data-id="${r.id}">
                <td>${r.nombre_area}</td>
                <td>${new Date(r.fecha).toLocaleDateString()}</td>
                <td>${r.hora_inicio?.slice(0,5)} - ${r.hora_fin?.slice(0,5)}</td>
                <td>${r.usuarios?.nombre || "-"}</td>
                <td>${r.estado === "aprobada" ? "Ocupado" : r.estado}</td>
                <td>${r.motivo || "—"}</td>
                ${rol === "administrador" ? `
                  <td>
                    ${
                      r.estado === "pendiente"
                        ? `
                          <button class="aprobar btnPrimario" data-id="${r.id}">Aprobar</button>
                          <button class="rechazar btnSecundario" data-id="${r.id}">Rechazar</button>
                        `
                        : "-"
                    }
                  </td>` : ""}
              </tr>
            `).join("")}
          </tbody>
        </table>`;

      if (rol === "administrador") {
        lista.querySelectorAll(".aprobar").forEach(b => b.addEventListener("click", async () => {
          const id = b.dataset.id;
          await supabase.from("reservas").update({ estado: "aprobada" }).eq("id", id);
          mostrarMensaje("Reserva aprobada (ocupado)", "success");
          await actualizar();
        }));

        lista.querySelectorAll(".rechazar").forEach(b => b.addEventListener("click", async () => {
          const id = b.dataset.id;
          await supabase.from("reservas").update({ estado: "rechazada" }).eq("id", id);
          mostrarMensaje("Reserva rechazada", "success");
          await actualizar();
        }));
      }
    }

    if (rol === "administrador") {
      filtroEstado.addEventListener("change", filtrarYRender);
      buscarInput.addEventListener("input", filtrarYRender);
    }

    filtrarYRender();
  }

  function abrirFormularioReserva(prefFecha = null) {
    const modal = document.getElementById("modalReserva");
    modal.classList.remove("hidden");
    modal.style.padding = "18px";
    modal.style.background = "#fff";
    modal.style.border = "1px solid #ddd";
    modal.style.borderRadius = "8px";
    modal.style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)";
    modal.innerHTML = `
      <h3>Crear reserva</h3>
      <form id="formReserva" style="display:grid;gap:8px;max-width:480px;">
        <label>Área</label>
        <select id="nombre_area">${AREAS.map(a=>`<option value="${a}">${a}</option>`).join("")}</select>
        <label>Fecha</label>
        <input type="date" id="fecha_reserva" value="${prefFecha || ""}" required />
        <div style="display:flex;gap:8px;">
          <div style="flex:1">
            <label>Hora inicio</label>
            <input type="time" id="hora_inicio" required />
          </div>
          <div style="flex:1">
            <label>Hora fin</label>
            <input type="time" id="hora_fin" required />
          </div>
        </div>
        <label>Motivo (opcional)</label>
        <input type="text" id="motivo" />
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" id="cancelarReserva" class="btnSecundario">Cancelar</button>
          <button type="submit" class="btnPrimario">Guardar</button>
        </div>
      </form>
    `;
    document.getElementById("cancelarReserva").addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.innerHTML = "";
    });

    document.getElementById("formReserva").addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuarioLocal = JSON.parse(localStorage.getItem("usuario"));
      const nombre_area = document.getElementById("nombre_area").value;
      const fecha = document.getElementById("fecha_reserva").value;
      const hora_inicio = document.getElementById("hora_inicio").value;
      const hora_fin = document.getElementById("hora_fin").value;
      const motivo = document.getElementById("motivo").value.trim();

      if (!fecha || !hora_inicio || !hora_fin) {
        mostrarMensaje("Completa fecha y horas", "error");
        return;
      }
      if (hora_fin <= hora_inicio) {
        mostrarMensaje("La hora fin debe ser mayor que la hora inicio", "error");
        return;
      }

      const { data: existentes } = await supabase
        .from("reservas")
        .select("id, fecha, hora_inicio, hora_fin, estado")
        .eq("nombre_area", nombre_area)
        .eq("fecha", fecha)
        .in("estado", ["pendiente","aprobada"]);

      const conflict = (existentes || []).some(r => !(hora_fin <= r.hora_inicio || hora_inicio >= r.hora_fin));
      if (conflict) {
        mostrarMensaje("Ya existe una reserva que se solapa en ese rango horario", "error");
        return;
      }

      await supabase.from("reservas").insert([{
        usuario_id: usuarioLocal.id,
        nombre_area,
        fecha,
        hora_inicio,
        hora_fin,
        motivo,
        estado: "pendiente"
      }]);

      mostrarMensaje("Reserva registrada. Espera aprobación del admin", "success");
      modal.classList.add("hidden");
      modal.innerHTML = "";
      await actualizar();
    });
  }
}
