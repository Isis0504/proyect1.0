// modules/certificados.js
import { supabase } from "../js/supabaseClient.js";
import { formatearFecha, mostrarMensaje } from "../js/utils.js";

/**
 * Busca si existe un certificado (PDF) del usuario y devuelve su URL pública
 */
async function obtenerCertificado(idUsuario) {
  const nombreArchivo = `paz_y_salvo_${idUsuario}.pdf`;
  const bucket = supabase.storage.from("certificados");

  // Buscar el archivo exacto en el bucket
  const { data: archivos, error: listError } = await bucket.list("", { limit: 200 });
  if (listError) {
    console.error("Error al listar archivos:", listError);
    return null;
  }

  const existe = archivos.find(f => f.name === nombreArchivo);
  if (!existe) {
    console.warn(`No se encontró el archivo ${nombreArchivo}`);
    return null;
  }

  // Obtener URL pública del archivo encontrado
  const { data: urlData } = bucket.getPublicUrl(nombreArchivo);
  return urlData?.publicUrl || null;
}

export async function render(contenedor) {
  const usuarioData = JSON.parse(localStorage.getItem("usuario"));

  if (!usuarioData) {
    mostrarMensaje("Error de sesión. Inicia sesión nuevamente.", "error");
    window.location.href = "../login.html";
    return;
  }

  const { rol, id: usuario_id } = usuarioData;

  contenedor.innerHTML = `
    <h2>📜 Certificados</h2>
    <div id="certificados-contenido"></div>
  `;

  if (rol === "administrador") {
    await renderAdmin(contenedor);
  } else {
    await renderUsuario(contenedor, usuario_id);
  }
}

/* =======================================================
   🔹 Vista Residente / Comité
   ======================================================= */
async function renderUsuario(contenedor, usuario_id) {
  const div = contenedor.querySelector("#certificados-contenido");
  div.innerHTML = `
    <section>
      <h3>🏠 Certificado de Paz y Salvo</h3>
      <button id="btnPazYSalvo">Descargar Paz y Salvo</button>
    </section>

    <section>
      <h3>📄 Solicitar Certificados</h3>
      <label>Tipo:</label>
      <select id="tipoCert">
        <option value="residencia">Certificado de Residencia</option>
        <option value="autorizacion">Certificado de Autorización</option>
      </select><br>
      <textarea id="comentarioCert" placeholder="Motivo o comentario (opcional)"></textarea><br>
      <button id="btnSolicitarCert">Enviar solicitud</button>
    </section>

    <section>
      <h3>🗂 Mis solicitudes</h3>
      <div id="lista-certificados"></div>
    </section>
  `;

  document.getElementById("btnPazYSalvo").onclick = () => verificarPazYSalvo(usuario_id);
  document.getElementById("btnSolicitarCert").onclick = () => {
    const tipo = document.getElementById("tipoCert").value;
    const comentario = document.getElementById("comentarioCert").value;
    solicitarCertificado(usuario_id, tipo, comentario);
  };

  await cargarSolicitudesUsuario(usuario_id);
}

/* =======================================================
   🔹 Vista Administrador
   ======================================================= */
async function renderAdmin(contenedor) {
  const div = contenedor.querySelector("#certificados-contenido");
  div.innerHTML = `
    <h3>📋 Solicitudes de Certificados</h3>
    <table border="1" cellspacing="0" cellpadding="5" width="100%">
      <thead>
        <tr>
          <th>Usuario</th>
          <th>Tipo</th>
          <th>Comentario</th>
          <th>Estado</th>
          <th>Archivo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="tabla-admin-certificados"></tbody>
    </table>
  `;
  await cargarSolicitudesAdmin();
}

/* =======================================================
   🔸 Funciones para Residente / Comité
   ======================================================= */
async function verificarPazYSalvo(usuario_id) {
  const { data: pagos, error } = await supabase
    .from("pagos")
    .select("estado")
    .eq("usuario_id", usuario_id);

  if (error) {
    console.error("Error al consultar pagos:", error);
    return mostrarMensaje("Error al consultar los pagos.", "error");
  }

  if (!pagos || pagos.length === 0) {
    return mostrarMensaje("No se encontraron pagos registrados.", "error");
  }

  // Verificar si TODOS los pagos están aprobados
  const todosAprobados = pagos.every(p => p.estado && p.estado.toLowerCase() === "aprobado");

  if (!todosAprobados) {
    return mostrarMensaje(
      "No puedes descargar el paz y salvo. Asegúrate de que todos tus pagos estén aprobados.",
      "error"
    );
  }

  // Si está al día, busca su certificado
  const url = await obtenerCertificado(usuario_id);

  if (!url) {
    return mostrarMensaje("No se encontró tu certificado de paz y salvo en el sistema.", "error");
  }

  // Abrir el certificado propio
  window.open(url, "_blank");
}

async function solicitarCertificado(usuario_id, tipo, comentario) {
  const { error } = await supabase.from("solicitudes_certificados").insert([
    { usuario_id, tipo, comentario, estado: "pendiente" },
  ]);

  if (error) return mostrarMensaje("Error al enviar solicitud.", "error");
  mostrarMensaje("Solicitud enviada correctamente ✅", "success");
  cargarSolicitudesUsuario(usuario_id);
}

async function cargarSolicitudesUsuario(usuario_id) {
  const { data, error } = await supabase
    .from("solicitudes_certificados")
    .select("*")
    .eq("usuario_id", usuario_id)
    .order("fecha_solicitud", { ascending: false });

  if (error) return console.error(error);

  const contenedor = document.getElementById("lista-certificados");
  contenedor.innerHTML = "";

  if (!data || data.length === 0) {
    contenedor.innerHTML = "<p>No tienes solicitudes registradas.</p>";
    return;
  }

  data.forEach((item) => {
    const div = document.createElement("div");
    div.classList.add("solicitud");

    let html = `
      <p><strong>${item.tipo === "residencia" ? "Certificado de Residencia" : "Autorización"}</strong></p>
      <p>Estado: <span class="${item.estado}">${item.estado}</span></p>
      <p>Comentario: ${item.comentario || "—"}</p>
      <p>Fecha: ${formatearFecha(item.fecha_solicitud)}</p>
    `;

    if (item.estado === "aprobado" && item.archivo_url) {
      html += `<a href="${item.archivo_url}" target="_blank">📄 Descargar certificado</a>`;
    } else if (item.estado === "rechazado") {
      html += `<p style="color:red;">Certificado rechazado, acérquese a administración.</p>`;
    }

    div.innerHTML = html;
    contenedor.appendChild(div);
  });
}

/* =======================================================
   🔸 Funciones para Administrador
   ======================================================= */
async function cargarSolicitudesAdmin() {
  const { data, error } = await supabase
    .from("solicitudes_certificados")
    .select("*, usuarios(nombre)")
    .order("fecha_solicitud", { ascending: false });

  if (error) return console.error(error);

  const tabla = document.getElementById("tabla-admin-certificados");
  tabla.innerHTML = "";

  data.forEach((item) => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${item.usuarios?.nombre || "—"}</td>
      <td>${item.tipo}</td>
      <td>${item.comentario || "—"}</td>
      <td>${item.estado}</td>
      <td>
        ${item.archivo_url ? `<a href="${item.archivo_url}" target="_blank">📄 Ver</a>` : "—"}
      </td>
      <td>
        <input type="file" id="file-${item.id}" style="margin-bottom:4px;"><br>
        <button onclick="aprobarCertificado('${item.id}')">✅ Aprobar</button>
        <button onclick="rechazarCertificado('${item.id}')">❌ Rechazar</button>
        <button onclick="subirCertificadoPDF('${item.id}')">⬆️ Subir PDF</button>
      </td>
    `;

    tabla.appendChild(fila);
  });
}

/* =======================================================
   🔹 Acciones del Administrador
   ======================================================= */
window.aprobarCertificado = async (id) => {
  const { error } = await supabase
    .from("solicitudes_certificados")
    .update({ estado: "aprobado", fecha_respuesta: new Date() })
    .eq("id", id);
  if (error) return console.error(error);
  cargarSolicitudesAdmin();
};

window.rechazarCertificado = async (id) => {
  const { error } = await supabase
    .from("solicitudes_certificados")
    .update({ estado: "rechazado", fecha_respuesta: new Date() })
    .eq("id", id);
  if (error) return console.error(error);
  cargarSolicitudesAdmin();
};

window.subirCertificadoPDF = async (id) => {
  const fileInput = document.getElementById(`file-${id}`);
  const file = fileInput.files[0];
  if (!file) return mostrarMensaje("Selecciona un archivo primero.", "error");

  const filePath = `certificados/${id}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("certificados")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error(uploadError);
    return mostrarMensaje("Error al subir archivo.", "error");
  }

  const { data: publicUrlData } = supabase.storage
    .from("certificados")
    .getPublicUrl(filePath);

  await supabase
    .from("solicitudes_certificados")
    .update({ archivo_url: publicUrlData.publicUrl })
    .eq("id", id);

  mostrarMensaje("Archivo subido correctamente ✅", "success");
  cargarSolicitudesAdmin();
};
