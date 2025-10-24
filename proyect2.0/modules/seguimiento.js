import { supabase } from "../js/supabaseClient.js";

export function render(contenedor) {
  contenedor.id = "modSeguimiento";
  cargarSeguimiento();
}

export async function cargarSeguimiento() {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const rol = usuario?.rol;

  if (!rol || !["administrador", "comite"].includes(rol)) {
    alert("No tienes permisos para acceder a este módulo.");
    return;
  }

  const contenedor = document.getElementById("modSeguimiento");
  contenedor.innerHTML = `
    <h2>Seguimiento de Solicitudes</h2>
    <p>Aquí puedes revisar y actualizar el estado y responder a las solicitudes.</p>

    <div class="filtros">
      <input type="text" id="buscarNombre" placeholder="Buscar por nombre..." />
      <select id="filtrarEstado">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="en proceso">En proceso</option>
        <option value="resuelta">Resuelta</option>
      </select>
    </div>

    <div id="listaSeguimiento"></div>
  `;

  const lista = document.getElementById("listaSeguimiento");
  const inputBuscar = document.getElementById("buscarNombre");
  const selectEstado = document.getElementById("filtrarEstado");

  async function cargarYRenderizar() {
    const { data, error } = await supabase
      .from("solicitudes")
      .select(`
        id,
        titulo,
        descripcion,
        estado,
        fecha,
        evidencia_url,
        usuarios:usuario_id (nombre),
        seguimiento (
          id,
          comentario,
          fecha,
          usuario_id
        )
      `)
      .order("fecha", { ascending: false });

    if (error) {
      console.error("Error al cargar solicitudes:", error);
      alert("Error al cargar las solicitudes");
      return;
    }

    let solicitudes = data;

    // Filtro por nombre
    const texto = inputBuscar.value.trim().toLowerCase();
    if (texto) {
      solicitudes = solicitudes.filter((s) =>
        s.usuarios?.nombre?.toLowerCase().includes(texto)
      );
    }

    // Filtro por estado
    const estadoSeleccionado = selectEstado.value;
    if (estadoSeleccionado) {
      solicitudes = solicitudes.filter((s) => s.estado === estadoSeleccionado);
    }

    if (!solicitudes || solicitudes.length === 0) {
      lista.innerHTML = "<p>No hay solicitudes que coincidan con los filtros.</p>";
      return;
    }

    lista.innerHTML = `
      <table class="tabla">
        <thead>
          <tr>
            <th>Residente</th>
            <th>Título</th>
            <th>Descripción</th>
            <th>Estado</th>
            <th>Seguimiento</th>
            <th>Evidencia</th>
            <th>Actualizar</th>
          </tr>
        </thead>
        <tbody>
          ${solicitudes
            .map(
              (s) => `
              <tr data-id="${s.id}">
                <td>${s.usuarios?.nombre || "—"}</td>
                <td>${s.titulo}</td>
                <td>${s.descripcion}</td>
                <td><span class="estado ${s.estado}">${s.estado}</span></td>
                <td>
                  <div class="comentarios">
                    ${
                      s.seguimiento?.length
                        ? s.seguimiento
                            .map(
                              (c) =>
                                `<p><strong>${new Date(
                                  c.fecha
                                ).toLocaleString()}:</strong> ${c.comentario}</p>`
                            )
                            .join("")
                        : "<em>Sin comentarios</em>"
                    }
                  </div>
                  <textarea class="nuevoComentario" placeholder="Agregar comentario..."></textarea>
                </td>
                <td>
                  ${
                    s.evidencia_url
                      ? `<a href="${s.evidencia_url}" target="_blank">Ver archivo</a>`
                      : "—"
                  }
                </td>
                <td>
                  <select class="cambiarEstado">
                    <option value="pendiente" ${
                      s.estado === "pendiente" ? "selected" : ""
                    }>Pendiente</option>
                    <option value="en proceso" ${
                      s.estado === "en proceso" ? "selected" : ""
                    }>En proceso</option>
                    <option value="resuelta" ${
                      s.estado === "resuelta" ? "selected" : ""
                    }>Resuelta</option>
                  </select>
                  <button class="guardarCambios">Guardar</button>
                </td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `;

    document.querySelectorAll(".guardarCambios").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const fila = e.target.closest("tr");
        const id = fila.getAttribute("data-id");
        const nuevoEstado = fila.querySelector(".cambiarEstado").value;
        const comentario = fila.querySelector(".nuevoComentario").value.trim();
        const user = JSON.parse(localStorage.getItem("usuario"));

        // Actualizar estado
        const { error: updateError } = await supabase
          .from("solicitudes")
          .update({ estado: nuevoEstado })
          .eq("id", id);

        if (updateError) {
          alert("Error al actualizar estado: " + updateError.message);
          return;
        }

        // Insertar comentario si hay texto
        if (comentario) {
          const { error: insertError } = await supabase.from("seguimiento").insert([
            {
              solicitud_id: id,
              usuario_id: user.id,
              comentario,
            },
          ]);

          if (insertError) {
            alert("Error al guardar comentario: " + insertError.message);
            return;
          }
        }

        alert("Actualización guardada correctamente.");
        fila.querySelector(".nuevoComentario").value = "";
        cargarYRenderizar();
      });
    });
  }

  // Cargar al inicio
  await cargarYRenderizar();

  // Eventos de filtro dinámico
  inputBuscar.addEventListener("input", cargarYRenderizar);
  selectEstado.addEventListener("change", cargarYRenderizar);
}
