// modules/perfil.js
import { supabase } from "../js/supabaseClient.js";
import { mostrarMensaje } from "../js/utils.js";

/**
 * Export: render(contenedor)
 * - contenedor: elemento DOM donde se inyectará el módulo (viene de cargarModulo)
 */
export async function render(contenedor) {
  contenedor.innerHTML = "<p>Cargando módulo de perfil...</p>";

  // Intentamos obtener usuario desde localStorage (lo llenas en login)
  let usuarioLocal = null;
  try {
    usuarioLocal = JSON.parse(localStorage.getItem("usuario") || "null");
  } catch (e) {
    usuarioLocal = null;
  }

  // Si no hay usuario en localStorage, intentamos obtener de supabase auth
  let authUserId = usuarioLocal?.id || null;
  if (!authUserId) {
    const { data: ud, error: ue } = await supabase.auth.getUser();
    if (ue || !ud?.user) {
      // no hay sesión: redirigir a login
      window.location.href = "../login.html";
      return;
    }
    authUserId = ud.user.id;
  }

  // Traer perfil del usuario logueado (por id)
  const { data: perfil, error: perfilErr } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", authUserId)
    .single();

  if (perfilErr || !perfil) {
    console.error("No se pudo obtener perfil:", perfilErr);
    contenedor.innerHTML = "<p>No se pudo obtener la información del usuario.</p>";
    return;
  }

  // Si el rol es administrador --> ver lista completa
  if (perfil.rol === "administrador") {
    await renderAdmin(contenedor);
  } else {
    await renderResidenteComite(contenedor, perfil);
  }
}

/* =========================
   Vista ADMIN: lista usuarios
   ========================= */
async function renderAdmin(contenedor) {
  contenedor.innerHTML = "<p>Cargando usuarios...</p>";

  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("creado_en", { ascending: true });

  if (error) {
    console.error("Error al listar usuarios:", error);
    contenedor.innerHTML = "<p>Error al cargar usuarios.</p>";
    return;
  }

  contenedor.innerHTML = `
    <section class="admin-usuarios" style="max-width:1000px; margin:20px auto;">
      <h2></h2>
      <table class="tabla-usuarios" style="width:100%; border-collapse: collapse;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid #ddd;">
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Teléfono</th>
            <th>Estado</th>
            <th>Creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${usuarios.map(u => `
            <tr data-id="${u.id}" style="border-bottom:1px solid #f0f0f0;">
              <td>${escapeHtml(u.nombre)}</td>
              <td>${escapeHtml(u.correo || "")}</td>
              <td>${escapeHtml(u.rol)}</td>
              <td>${escapeHtml(u.telefono || "")}</td>
              <td>${escapeHtml(u.estado || "pendiente")}</td>
              <td>${new Date(u.creado_en).toLocaleString()}</td>
              <td>
                ${u.estado === "pendiente" ? `<button class="btn-aprobar" data-id="${u.id}">Aprobar</button>` : ""}
                <button class="btn-editar" data-id="${u.id}">Editar</button>
                <button class="btn-eliminar" data-id="${u.id}">Eliminar</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;

  // agregar listeners
  contenedor.querySelectorAll(".btn-aprobar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("¿Aprobar este usuario?")) return;
      const { error } = await supabase.from("usuarios").update({ estado: "aprobado" }).eq("id", id);
      if (error) {
        mostrarMensaje ? mostrarMensaje("Error al aprobar usuario", "error") : alert("Error al aprobar usuario");
        console.error(error);
        return;
      }
      mostrarMensaje ? mostrarMensaje("Usuario aprobado", "success") : alert("Usuario aprobado");
      await renderAdmin(contenedor);
    });
  });

  contenedor.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("¿Eliminar este usuario? Esta acción es irreversible.")) return;
      const { error } = await supabase.from("usuarios").delete().eq("id", id);
      if (error) {
        mostrarMensaje ? mostrarMensaje("Error al eliminar usuario", "error") : alert("Error al eliminar usuario");
        console.error(error);
        return;
      }
      mostrarMensaje ? mostrarMensaje("Usuario eliminado", "success") : alert("Usuario eliminado");
      await renderAdmin(contenedor);
    });
  });

  contenedor.querySelectorAll(".btn-editar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await abrirEditorAdmin(contenedor, id);
    });
  });
}

/* =========================
   Editor ADMIN para un usuario
   ========================= */
async function abrirEditorAdmin(contenedor, id) {
  // obtener usuario
  const { data: usuario, error } = await supabase.from("usuarios").select("*").eq("id", id).single();
  if (error || !usuario) {
    mostrarMensaje ? mostrarMensaje("Error al cargar usuario", "error") : alert("Error al cargar usuario");
    console.error(error);
    return;
  }

  contenedor.innerHTML = `
    <section style="max-width:600px; margin:20px auto;">
      <h2>Editar Usuario: ${escapeHtml(usuario.nombre)}</h2>
      <form id="form-editar-admin">
        <label>Nombre</label>
        <input id="e-nombre" value="${escapeHtml(usuario.nombre)}">

        <label>Correo</label>
        <input id="e-correo" value="${escapeHtml(usuario.correo || "")}">

        <label>Teléfono</label>
        <input id="e-telefono" value="${escapeHtml(usuario.telefono || "")}">

        <label>Rol</label>
        <select id="e-rol">
          <option value="residente" ${usuario.rol === "residente" ? "selected" : ""}>Residente</option>
          <option value="comite" ${usuario.rol === "comite" ? "selected" : ""}>Comité</option>
          <option value="administrador" ${usuario.rol === "administrador" ? "selected" : ""}>Administrador</option>
        </select>

        <label>Estado</label>
        <select id="e-estado">
          <option value="pendiente" ${usuario.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="aprobado" ${usuario.estado === "aprobado" ? "selected" : ""}>Aprobado</option>
          <option value="inactivo" ${usuario.estado === "inactivo" ? "selected" : ""}>Inactivo</option>
        </select>

        <div style="margin-top:12px;">
          <button type="submit">Guardar</button>
          <button id="voler-lista" type="button" style="margin-left:8px;">Volver</button>
        </div>
      </form>
    </section>
  `;

  document.getElementById("voler-lista").addEventListener("click", () => render(contenedor));
  document.getElementById("form-editar-admin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("e-nombre").value.trim();
    const correo = document.getElementById("e-correo").value.trim();
    const telefono = document.getElementById("e-telefono").value.trim();
    const rol = document.getElementById("e-rol").value;
    const estado = document.getElementById("e-estado").value;

    const { error } = await supabase.from("usuarios").update({ nombre, correo, telefono, rol, estado }).eq("id", id);
    if (error) {
      mostrarMensaje ? mostrarMensaje("Error al actualizar usuario", "error") : alert("Error al actualizar usuario");
      console.error(error);
      return;
    }
    mostrarMensaje ? mostrarMensaje("Usuario actualizado", "success") : alert("Usuario actualizado");
    await render(contenedor);
  });
}

/* =========================
   Vista RESIDENTE / COMITÉ: su propio perfil
   ========================= */
async function renderResidenteComite(contenedor, perfil) {
  contenedor.innerHTML = `
    <section style="max-width:520px; margin:20px auto;">
      <h2>Mi Perfil</h2>
      <form id="form-mi-perfil">
        <label>Nombre</label>
        <input id="m-nombre" value="${escapeHtml(perfil.nombre)}" disabled>

        <label>Correo</label>
        <input id="m-correo" value="${escapeHtml(perfil.correo || "")}" disabled>

        <label>Teléfono</label>
        <input id="m-telefono" value="${escapeHtml(perfil.telefono || "")}" placeholder="Tu número">

        <label>Rol</label>
        <input id="m-rol" value="${escapeHtml(perfil.rol)}" disabled>

        <label>Estado</label>
        <input id="m-estado" value="${escapeHtml(perfil.estado || "pendiente")}" disabled>

        <div style="margin-top:12px;">
          <button type="submit">Actualizar teléfono</button>
        </div>
      </form>
    </section>
  `;

  document.getElementById("form-mi-perfil").addEventListener("submit", async (e) => {
    e.preventDefault();
    const telefono = document.getElementById("m-telefono").value.trim();

    const { error } = await supabase.from("usuarios").update({ telefono }).eq("id", perfil.id);
    if (error) {
      mostrarMensaje ? mostrarMensaje("Error al actualizar teléfono", "error") : alert("Error al actualizar teléfono");
      console.error(error);
      return;
    }

    mostrarMensaje ? mostrarMensaje("Teléfono actualizado", "success") : alert("Teléfono actualizado");
    // actualizar localStorage nombre/telefono si lo deseas
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario") || "{}");
    usuarioLocal.telefono = telefono;
    localStorage.setItem("usuario", JSON.stringify(usuarioLocal));
    // recargar vista
    await render(contenedor);
  });
}

/* =========================
   Helper: escapar HTML
   ========================= */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
