
const API_URL = "http://localhost:3000/api/usuarios";

const btnIniciarSesion = document.getElementById("btnIniciarSesion");
const accionesVisitante = document.getElementById("accionesVisitante");
const perfilUsuario = document.getElementById("perfilUsuario");
const nombreUsuario = document.getElementById("nombreUsuario");

const tituloBienvenida = document.getElementById("tituloBienvenida");
const textoBienvenida = document.getElementById("textoBienvenida");

const listaReportes = document.getElementById("listaReportes");
const listaNotificaciones = document.getElementById("listaNotificaciones");

// Contadores de reportes del usuario
const totalReportes = document.getElementById("totalReportes");
const reportesPendientes = document.getElementById("reportesPendientes");
const reportesResueltos = document.getElementById("reportesResueltos");

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

// Consultar los reportes recientes del usuario autenticado
async function cargarReportesRecientes(token) {
    listaReportes.textContent = "Cargando tus reportes recientes...";

    try {
        const respuesta = await fetch(
            "http://localhost:3000/api/reportes/mis-reportes",
            {
                headers: {
                    Authorization: "Bearer " + token
                }
            }
        );

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los reportes");
        }

        const datos = await respuesta.json();

        // Calcular estadísticas del usuario
        const reportes = datos.reportes;

        const pendientes = reportes.filter(
            reporte => reporte.estado?.trim().toLowerCase() === "pendiente"
        ).length;

        const resueltos = reportes.filter(
            reporte => reporte.estado?.trim().toLowerCase() === "resuelto"
        ).length;

        // Actualizar los contadores de Inicio
        totalReportes.textContent = reportes.length;
        reportesPendientes.textContent = pendientes;
        reportesResueltos.textContent = resueltos;

        if (datos.reportes.length === 0) {
            listaReportes.textContent =
                "Todavía no realizaste ningún reporte.";
            return;
        }

        // Mostrar únicamente los últimos 3 reportes
        const recientes = datos.reportes.slice(0, 3);

        listaReportes.replaceChildren();

        recientes.forEach(reporte => {
            const elemento = document.createElement("p");

            elemento.textContent =
                `#${reporte.id_reporte} - ${reporte.titulo} | Estado: ${reporte.estado}`;

            listaReportes.appendChild(elemento);
        });

    } catch (error) {
        console.error("Error al cargar reportes recientes:", error);

        listaReportes.textContent =
            "No se pudieron cargar tus reportes recientes.";
    }
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
        cargarReportesRecientes(token);

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