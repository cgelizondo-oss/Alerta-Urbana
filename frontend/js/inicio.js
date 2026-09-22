
const API_URL = "http://localhost:3000/api/usuarios";

const btnIniciarSesion = document.getElementById("btnIniciarSesion");
const accionesVisitante = document.getElementById("accionesVisitante");
const perfilUsuario = document.getElementById("perfilUsuario");
const nombreUsuario = document.getElementById("nombreUsuario");

const tituloBienvenida = document.getElementById("tituloBienvenida");
const textoBienvenida = document.getElementById("textoBienvenida");

const listaReportes = document.getElementById("listaReportes");
const listaNotificaciones = document.getElementById("listaNotificaciones");

// Estado inicial: visitante
function mostrarVisitante() {
    accionesVisitante.hidden = false;
    perfilUsuario.hidden = true;

    tituloBienvenida.textContent = "¡Bienvenido a Alerta Urbana!";
    textoBienvenida.textContent =
        "Explorá los reportes de tu ciudad. Para crear uno, iniciá sesión.";

    listaReportes.textContent = "Iniciá sesión para ver tus reportes.";
    listaNotificaciones.textContent =
        "Iniciá sesión para ver tus notificaciones.";
}

// Estado de usuario autenticado
function mostrarUsuario(usuario) {
    const nombre = usuario.nombre || "Usuario";

    accionesVisitante.hidden = true;
    perfilUsuario.hidden = false;

    nombreUsuario.textContent = nombre;
    tituloBienvenida.textContent = `¡Hola, ${nombre}!`;

    textoBienvenida.textContent = "¿Qué deseas hacer hoy?";

    listaReportes.textContent = "Todavía no hay reportes para mostrar.";
    listaNotificaciones.textContent =
        "No hay notificaciones para mostrar.";
}

// Comprobar la sesión con el backend
async function comprobarSesion() {
    mostrarVisitante();

    const token = localStorage.getItem("token");

    if (!token) {
        return;
    }

    try {
        const respuesta = await fetch(`${API_URL}/perfil`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (respuesta.status === 401 || respuesta.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");
            return;
        }

        if (!respuesta.ok) {
            // Ante un error del servidor, no damos la sesión por válida.
            return;
        }

        const datos = await respuesta.json();

        // El perfil confirmado por el backend es la fuente de confianza.
        const usuario = datos.usuario || datos;

        mostrarUsuario(usuario);

    } catch (error) {
        console.error("No se pudo comprobar la sesión:", error);
        // Inicio sigue siendo accesible como página pública.
    }
}

comprobarSesion();


const btnCerrarSesion = document.getElementById("btnCerrarSesion");

btnCerrarSesion.addEventListener("click", () => {
    // Eliminar los datos de autenticación guardados en el navegador
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");

    // Volver a mostrar Inicio como visitante
    mostrarVisitante();
});


/* =========================
   MENÚ MOBILE
========================= */

const menuToggle = document.getElementById("menuToggle");
const menuMobile = document.getElementById("menuMobile");
const sidebarBottom = document.querySelector(".sidebar-bottom");

menuToggle.addEventListener("click", () => {
    const estaAbierto = menuMobile.classList.toggle("menu-open");

    // Mostrar u ocultar Configuración y Ayuda
    sidebarBottom.classList.toggle("menu-open", estaAbierto);

    // Actualizar el estado del botón
    menuToggle.setAttribute("aria-expanded", String(estaAbierto));
    menuToggle.setAttribute(
        "aria-label",
        estaAbierto ? "Cerrar menú de navegación" : "Abrir menú de navegación"
    );

    menuToggle.textContent = estaAbierto ? "✕" : "☰";
});