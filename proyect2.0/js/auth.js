// /js/auth.js
import { supabase } from "./supabaseClient.js";

/**
 * Inicia sesión usando Supabase Auth y valida estado del usuario
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    alert("Correo o contraseña incorrectos.");
    console.error(error);
    return;
  }

  const userId = data.user.id;

  // Buscar en tabla 'usuarios' usando id_auth
  const { data: usuario, error: rolError } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", userId)
    .single();

  if (rolError || !usuario) {
    alert("No se pudo obtener los datos del usuario.");
    console.error(rolError);
    return;
  }

  // Validar estado antes de permitir acceso
  if (usuario.estado !== "registrado" && usuario.estado !== "aprobado") {
    alert("Tu cuenta está pendiente de aprobación por el administrador.");
    await supabase.auth.signOut();
    return;
  }

  // Guardar sesión en localStorage
  localStorage.setItem(
    "usuario",
    JSON.stringify({
      id: userId,
      email: data.user.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      estado: usuario.estado,
    })
  );

  // Redirigir según rol
  switch (usuario.rol) {
    case "administrador":
      window.location.href = "./admin/dashboard.html";
      break;
    case "comite":
      window.location.href = "./comite/dashboard.html";
      break;
    case "residente":
      window.location.href = "./residente/dashboard.html";
      break;
    default:
      alert("Rol no reconocido.");
      await supabase.auth.signOut();
  }
}

/**
 * Verifica sesión activa y permisos
 */
export async function verificarSesion(rolesPermitidos = []) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    window.location.href = "../login.html";
    return;
  }

  const userId = data.user.id;
  const { data: usuario, error: rolError } = await supabase
    .from("usuarios")
    .select("nombre, rol, estado")
    .eq("id", userId)
    .single();

  if (rolError) {
    console.error("Error al obtener usuario:", rolError);
    window.location.href = "../login.html";
    return;
  }

  if (!rolesPermitidos.includes(usuario.rol) || usuario.estado !== "aprobado") {
    alert("No tienes permiso o tu cuenta no está activa.");
    window.location.href = "../login.html";
    return;
  }

  // Mostrar nombre en interfaz
  const nombreUsuario = document.getElementById("nombreUsuario");
  if (nombreUsuario) nombreUsuario.textContent = usuario.nombre;
}


/**
 * Cierra sesión y limpia almacenamiento
 */
export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem("usuario");
  window.location.href = "../login.html";
}
