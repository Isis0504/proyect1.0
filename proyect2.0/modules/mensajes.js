// modules/mensajes.js
import { supabase } from "../js/supabaseClient.js";
import { mostrarMensaje } from "../js/utils.js";

/**
 * Módulo Mensajes (Anuncios, Actividades calendario mes actual, Foro)
 * - render(contenedor) --> inicializa vista según rol (admin o residente/comite)
 *
 * Requisitos:
 * - tabla "anuncios" (id, titulo, contenido, fecha)
 * - tabla "actividades" (id, titulo, fecha)
 * - tabla "foro_mensajes" (id, usuario_id, mensaje, fecha)
 * - tabla "usuarios" debe existir para el join en foro
 */

export async function render(contenedor) {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  if (!usuario) {
    contenedor.innerHTML = "<p>No hay sesión activa. Vuelve a iniciar sesión.</p>";
    return;
  }
  const rol = usuario.rol;

  contenedor.innerHTML = `
    <div class="mensajes-wrap">
      <section class="card anuncios-card">
        <header><h2>Anuncios</h2></header>
        <div id="listaAnuncios" class="lista-anuncios">Cargando anuncios...</div>
        ${rol === "administrador" ? `<div id="formAnuncio" class="form-area"></div>` : ""}
      </section>

      <section class="card calendario-card">
        <header><h2>Calendario (mes actual)</h2></header>
        <div id="calendario" class="calendario">Cargando calendario...</div>
        ${rol === "administrador" ? `<div id="formActividad" class="form-area"></div>` : ""}
      </section>

      <section class="card foro-card">
        <header><h2>Foro comunitario</h2></header>
        <div id="foroMensajes" class="foro-mensajes">Cargando foro...</div>
        ${rol !== "administrador" ? `<div id="formForo" class="form-area"></div>` : `<p class="solo-lectura">El administrador solo puede ver el foro (solo lectura).</p>`}
      </section>
    </div>
  `;

  // cargar datos
  await cargarAnuncios(rol);
  await cargarCalendario(rol);
  await cargarForo();

  // montar formularios
  if (rol === "administrador") montarFormAnuncio();
  if (rol === "administrador") montarFormActividad();
  if (rol !== "administrador") montarFormForo(usuario.id);
}

/* ---------- ANUNCIOS ---------- */
async function cargarAnuncios(rol) {
  const cont = document.getElementById("listaAnuncios");
  cont.innerHTML = "<p>Cargando anuncios...</p>";

  const { data, error } = await supabase
    .from("anuncios")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) {
    console.error(error);
    cont.innerHTML = "<p>Error cargando anuncios.</p>";
    return;
  }
  if (!data || data.length === 0) {
    cont.innerHTML = "<p>No hay anuncios.</p>";
    return;
  }

  cont.innerHTML = "";
  data.forEach(a => cont.appendChild(crearElementoAnuncio(a, rol)));
}

function crearElementoAnuncio(anuncio, rol) {
  const wrap = document.createElement("div");
  wrap.className = "anuncio";

  const titulo = document.createElement("h3");
  titulo.textContent = anuncio.titulo;
  wrap.appendChild(titulo);

  const contenido = document.createElement("p");
  contenido.textContent = anuncio.contenido;
  wrap.appendChild(contenido);

  const fecha = document.createElement("small");
  fecha.className = "fecha";
  fecha.textContent = new Date(anuncio.fecha).toLocaleDateString("es-CO");
  wrap.appendChild(fecha);

  if (rol === "administrador") {
    const acciones = document.createElement("div");
    acciones.className = "acciones";
    const editar = document.createElement("button");
    editar.className = "btn small";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => editarAnuncio(anuncio));
    const eliminar = document.createElement("button");
    eliminar.className = "btn small ghost";
    eliminar.textContent = "Eliminar";
    eliminar.addEventListener("click", () => eliminarAnuncio(anuncio.id));
    acciones.appendChild(editar);
    acciones.appendChild(eliminar);
    wrap.appendChild(acciones);
  }

  return wrap;
}

function montarFormAnuncio() {
  const cont = document.getElementById("formAnuncio");
  cont.innerHTML = `
    <input id="tituloAnuncio" placeholder="Título" />
    <textarea id="contenidoAnuncio" placeholder="Contenido"></textarea>
    <div class="form-actions">
      <button id="btnPublicarAnuncio" class="btn">Publicar</button>
      <button id="btnLimpiarAnuncio" class="btn ghost">Limpiar</button>
    </div>
  `;
  document.getElementById("btnPublicarAnuncio").addEventListener("click", publicarAnuncio);
  document.getElementById("btnLimpiarAnuncio").addEventListener("click", () => {
    document.getElementById("tituloAnuncio").value = "";
    document.getElementById("contenidoAnuncio").value = "";
  });
}

async function publicarAnuncio() {
  const titulo = document.getElementById("tituloAnuncio").value.trim();
  const contenido = document.getElementById("contenidoAnuncio").value.trim();
  if (!titulo || !contenido) return mostrarMensaje("Completa título y contenido", "error");

  const { error } = await supabase.from("anuncios").insert([{ titulo, contenido }]);
  if (error) { console.error(error); return mostrarMensaje("No se pudo publicar", "error"); }
  mostrarMensaje("Anuncio publicado", "success");
  document.getElementById("tituloAnuncio").value = "";
  document.getElementById("contenidoAnuncio").value = "";
  await cargarAnuncios("administrador");
}

async function editarAnuncio(anuncio) {
  const nuevoTitulo = prompt("Editar título:", anuncio.titulo);
  if (nuevoTitulo === null) return;
  const nuevoContenido = prompt("Editar contenido:", anuncio.contenido);
  if (nuevoContenido === null) return;

  const { error } = await supabase.from("anuncios").update({ titulo: nuevoTitulo, contenido: nuevoContenido }).eq("id", anuncio.id);
  if (error) { console.error(error); return mostrarMensaje("No se pudo actualizar", "error"); }
  mostrarMensaje("Anuncio actualizado", "success");
  await cargarAnuncios("administrador");
}

async function eliminarAnuncio(id) {
  if (!confirm("¿Eliminar anuncio?")) return;
  const { error } = await supabase.from("anuncios").delete().eq("id", id);
  if (error) { console.error(error); return mostrarMensaje("No se pudo eliminar", "error"); }
  mostrarMensaje("Anuncio eliminado", "success");
  await cargarAnuncios("administrador");
}

/* ---------- CALENDARIO / ACTIVIDADES ---------- */
async function cargarCalendario(rol) {
  const cont = document.getElementById("calendario");
  cont.innerHTML = "<p>Cargando calendario...</p>";

  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = hoy.getMonth();

  const primerDia = new Date(year, month, 1).toISOString().slice(0,10);
  const ultimoDia = new Date(year, month + 1, 0).toISOString().slice(0,10);

  const { data: actividades = [], error } = await supabase
    .from("actividades")
    .select("*")
    .gte("fecha", primerDia)
    .lte("fecha", ultimoDia)
    .order("fecha", { ascending: true });

  if (error) {
    console.error(error);
    cont.innerHTML = "<p>Error cargando actividades.</p>";
    return;
  }

  // grid básico
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const grid = document.createElement("div");
  grid.className = "grid-calendario";

  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const actividad = actividades.find(a => a.fecha === fechaStr);

    const celda = document.createElement("div");
    celda.className = "celda";
    if (actividad) celda.classList.add("ocupado");

    const n = document.createElement("div");
    n.className = "num";
    n.textContent = d;
    celda.appendChild(n);

    if (actividad) {
      const t = document.createElement("div");
      t.className = "act-titulo";
      t.textContent = actividad.titulo;
      celda.appendChild(t);

      if (rol === "administrador") {
        const acciones = document.createElement("div");
        acciones.className = "acciones-small";
        const editar = document.createElement("button");
        editar.className = "btn small";
        editar.textContent = "Editar";
        editar.addEventListener("click", () => editarActividad(actividad));
        const eliminar = document.createElement("button");
        eliminar.className = "btn small ghost";
        eliminar.textContent = "Eliminar";
        eliminar.addEventListener("click", () => eliminarActividad(actividad.id));
        acciones.appendChild(editar);
        acciones.appendChild(eliminar);
        celda.appendChild(acciones);
      }
    }

    grid.appendChild(celda);
  }

  cont.innerHTML = "";
  cont.appendChild(grid);
}

function montarFormActividad() {
  const cont = document.getElementById("formActividad");
  cont.innerHTML = `
    <input id="tituloActividad" placeholder="Título actividad" />
    <input id="fechaActividad" type="date" />
    <div class="form-actions">
      <button id="btnAgregarActividad" class="btn">Agregar</button>
      <button id="btnLimpiarActividad" class="btn ghost">Limpiar</button>
    </div>
  `;
  document.getElementById("btnAgregarActividad").addEventListener("click", agregarActividad);
  document.getElementById("btnLimpiarActividad").addEventListener("click", () => {
    document.getElementById("tituloActividad").value = "";
    document.getElementById("fechaActividad").value = "";
  });
}

async function agregarActividad() {
  const titulo = document.getElementById("tituloActividad").value.trim();
  const fecha = document.getElementById("fechaActividad").value;
  if (!titulo || !fecha) return mostrarMensaje("Completa título y fecha", "error");

  const { error } = await supabase.from("actividades").insert([{ titulo, fecha }]);
  if (error) { console.error(error); return mostrarMensaje("No se pudo agregar", "error"); }
  mostrarMensaje("Actividad agregada", "success");
  document.getElementById("tituloActividad").value = "";
  document.getElementById("fechaActividad").value = "";
  await cargarCalendario("administrador");
}

async function editarActividad(actividad) {
  const nuevoTitulo = prompt("Editar título:", actividad.titulo);
  if (nuevoTitulo === null) return;
  const nuevaFecha = prompt("Editar fecha (YYYY-MM-DD):", actividad.fecha);
  if (nuevaFecha === null) return;

  const { error } = await supabase.from("actividades").update({ titulo: nuevoTitulo, fecha: nuevaFecha }).eq("id", actividad.id);
  if (error) { console.error(error); return mostrarMensaje("No se pudo editar", "error"); }
  mostrarMensaje("Actividad actualizada", "success");
  await cargarCalendario("administrador");
}

async function eliminarActividad(id) {
  if (!confirm("¿Eliminar actividad?")) return;
  const { error } = await supabase.from("actividades").delete().eq("id", id);
  if (error) { console.error(error); return mostrarMensaje("No se pudo eliminar", "error"); }
  mostrarMensaje("Actividad eliminada", "success");
  await cargarCalendario("administrador");
}

/* ---------- FORO ---------- */
async function cargarForo() {
  const cont = document.getElementById("foroMensajes");
  cont.innerHTML = "<p>Cargando foro...</p>";

  const { data, error } = await supabase
    .from("foro_mensajes")
    .select("id, mensaje, fecha, usuarios (nombre)")
    .order("fecha", { ascending: false });

  if (error) {
    console.error(error);
    cont.innerHTML = "<p>Error cargando foro.</p>";
    return;
  }

  if (!data || data.length === 0) {
    cont.innerHTML = "<p>No hay mensajes.</p>";
    return;
  }

  cont.innerHTML = "";
  data.forEach(m => {
    const el = document.createElement("div");
    el.className = "foro-item";
    const autor = document.createElement("strong");
    autor.textContent = m.usuarios?.nombre || "Usuario";
    el.appendChild(autor);
    const txt = document.createElement("p");
    txt.textContent = m.mensaje;
    el.appendChild(txt);
    const fecha = document.createElement("small");
    fecha.textContent = new Date(m.fecha).toLocaleString("es-CO");
    el.appendChild(fecha);
    cont.appendChild(el);
  });
}

function montarFormForo(usuario_id) {
  const cont = document.getElementById("formForo");
  cont.innerHTML = `
    <textarea id="mensajeForo" placeholder="Escribe un mensaje..." rows="3"></textarea>
    <div class="form-actions">
      <button id="btnEnviarForo" class="btn">Enviar</button>
      <button id="btnLimpiarForo" class="btn ghost">Limpiar</button>
    </div>
  `;
  document.getElementById("btnEnviarForo").addEventListener("click", async () => {
    const mensaje = document.getElementById("mensajeForo").value.trim();
    if (!mensaje) return mostrarMensaje("Escribe algo antes de enviar", "error");
    const { error } = await supabase.from("foro_mensajes").insert([{ usuario_id, mensaje }]);
    if (error) { console.error(error); return mostrarMensaje("No se pudo enviar", "error"); }
    mostrarMensaje("Mensaje publicado", "success");
    document.getElementById("mensajeForo").value = "";
    await cargarForo();
  });
  document.getElementById("btnLimpiarForo").addEventListener("click", () => {
    document.getElementById("mensajeForo").value = "";
  });
}
