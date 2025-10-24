import { supabase } from "../js/supabaseClient.js";

export function render(contenedor) {
  contenedor.id = "modSolicitudes";
  cargarSolicitudes();
}

export async function cargarSolicitudes() {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const userId = usuario?.id;

  if (!userId) {
    alert("Error: No se encontró el usuario en sesión.");
    return;
  }

  const contenedor = document.getElementById("modSolicitudes");
  contenedor.innerHTML = `
    <h2>Mis Solicitudes</h2>

    <form id="nuevaSolicitudForm" class="formulario">
      <input type="text" id="tituloSolicitud" placeholder="Título" required />
      <textarea id="descripcionSolicitud" placeholder="Descripción" required></textarea>

      <label for="archivoEvidencia">Evidencia (opcional):</label>
      <input type="file" id="archivoEvidencia" accept="image/*,application/pdf" />

      <button type="submit">Enviar Solicitud</button>
    </form>

    <h3>Solicitudes Registradas</h3>
    <div id="listaSolicitudes"></div>
  `;

  const form = document.getElementById("nuevaSolicitudForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titulo = document.getElementById("tituloSolicitud").value.trim();
    const descripcion = document.getElementById("descripcionSolicitud").value.trim();
    const archivo = document.getElementById("archivoEvidencia").files[0];

    if (!titulo || !descripcion) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    let evidenciaUrl = null;

    if (archivo) {
      const nombreArchivo = `${userId}_${Date.now()}_${archivo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("evidencias")
        .upload(nombreArchivo, archivo);

      if (uploadError) {
        alert("Error al subir la evidencia: " + uploadError.message);
        console.error(uploadError);
      } else {
        const { data: publicUrl } = supabase.storage
          .from("evidencias")
          .getPublicUrl(nombreArchivo);
        evidenciaUrl = publicUrl.publicUrl;
      }
    }

    const { error } = await supabase.from("solicitudes").insert([
      {
        usuario_id: userId,
        titulo,
        descripcion,
        evidencia_url: evidenciaUrl,
        estado: "pendiente",
        fecha: new Date().toISOString(),
      },
    ]);

    if (error) {
      alert("Error al registrar la solicitud: " + error.message);
      console.error(error);
    } else {
      alert("Solicitud registrada correctamente.");
      form.reset();
      cargarListaSolicitudes();
    }
  });

  cargarListaSolicitudes();
}

async function cargarListaSolicitudes() {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const userId = usuario?.id;

  const { data, error } = await supabase
    .from("solicitudes")
    .select(`
      id,
      titulo,
      descripcion,
      evidencia_url,
      estado,
      fecha,
      seguimiento (
        id,
        comentario,
        fecha,
        usuario_id
      )
    `)
    .eq("usuario_id", userId)
    .order("fecha", { ascending: false });

  if (error) {
    console.error("Error cargando solicitudes:", error);
    return;
  }

  const lista = document.getElementById("listaSolicitudes");
  if (!data || data.length === 0) {
    lista.innerHTML = "<p>No tienes solicitudes registradas.</p>";
    return;
  }

  lista.innerHTML = `
    <table class="tabla">
      <thead>
        <tr>
          <th>Título</th>
          <th>Descripción</th>
          <th>Estado</th>
          <th>Fecha</th>
          <th>Evidencia</th>
          <th>Respuesta del Comité/Admin</th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (s) => `
            <tr>
              <td>${s.titulo}</td>
              <td>${s.descripcion}</td>
              <td><span class="estado ${s.estado}">${s.estado}</span></td>
              <td>${new Date(s.fecha).toLocaleString()}</td>
              <td>
                ${
                  s.evidencia_url
                    ? `<a href="${s.evidencia_url}" target="_blank">Ver archivo</a>`
                    : "—"
                }
              </td>
              <td>
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
                    : "<em>Sin respuesta</em>"
                }
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}
