
const API_REPORTES = "http://localhost:3000/api/reportes/mis-reportes";
const API_USUARIOS_URL = "http://localhost:3000/api/usuarios";

const listaMisReportes = document.getElementById("listaMisReportes");

async function protegerMisReportes() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html?motivo=reporte";
        return false;
    }

    try {
        const respuesta = await fetch(`${API_USUARIOS_URL}/perfil`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!respuesta.ok) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");
            window.location.href = "login.html?motivo=reporte";
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error al verificar la sesión:", error);
        window.location.href = "login.html?motivo=reporte";
        return false;
    }
}

async function cargarMisReportes() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const respuesta = await fetch(API_REPORTES, {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        if (respuesta.status === 401 || respuesta.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");
            window.location.href = "login.html";
            return;
        }

        if (!respuesta.ok) {
            throw new Error("No se pudieron consultar los reportes");
        }

        const datos = await respuesta.json();

        console.log("Mis reportes:", datos.reportes);

        listaMisReportes.replaceChildren();

        if (datos.reportes.length === 0) {
            listaMisReportes.textContent =
                "Todavía no realizaste ningún reporte.";
            return;
        }

        datos.reportes.forEach(reporte => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "reporte-card";

            const titulo = document.createElement("h3");
            titulo.textContent = `#${reporte.id_reporte} - ${reporte.titulo}`;

            const ubicacion = document.createElement("p");
            ubicacion.textContent = `Ubicación: ${reporte.ubicacion}`;

            const fecha = document.createElement("p");
            fecha.textContent =
                `Fecha: ${new Date(reporte.fecha_creacion).toLocaleDateString("es-AR")}`;

            const tipo = document.createElement("p");
            tipo.textContent = `Tipo de incidencia: ${reporte.tipo_incidencia}`;

            const estado = document.createElement("p");
            estado.textContent = `Estado: ${reporte.estado}`;
            estado.className = "reporte-estado";

            const nombreEstado = reporte.estado.trim().toLowerCase();

            if (nombreEstado === "en proceso") {
                estado.classList.add("estado-proceso");
            } else if (nombreEstado === "resuelto") {
                estado.classList.add("estado-resuelto");
            }

            // Enlace para ver la información completa del reporte
            const verDetalles = document.createElement("a");

            verDetalles.href = `detalle-reporte.html?id=${reporte.id_reporte}`;
            verDetalles.textContent = "Ver detalles";
            verDetalles.className = "btn-ver-detalles";

            tarjeta.append(titulo, tipo, ubicacion, fecha, estado, verDetalles);
            listaMisReportes.appendChild(tarjeta);
        });

    } catch (error) {
        console.error("Error al cargar mis reportes:", error);

        listaMisReportes.replaceChildren();

        const tituloError = document.createElement("strong");
        tituloError.textContent = "❌ Error al cargar los reportes";

        const detalleError = document.createElement("p");
        detalleError.textContent =
            "No pudimos conectarnos con el servidor. Intentá nuevamente más tarde.";

        listaMisReportes.append(tituloError, detalleError);
        listaMisReportes.classList.add("mensaje-error");
    }
}

(async () => {
    const sesionValida = await protegerMisReportes();

    if (!sesionValida) return;

    await cargarMisReportes();
})();

/* =========================
   MENÚ MÓVIL
========================= */

const menuToggle = document.getElementById("menuToggle");
const menuMobile = document.getElementById("menuMobile");
const sidebarBottom = document.querySelector(".sidebar-bottom");

menuToggle.addEventListener("click", () => {
    const estaAbierto = menuMobile.classList.toggle("menu-open");

    sidebarBottom.classList.toggle("menu-open", estaAbierto);

    menuToggle.setAttribute("aria-expanded", String(estaAbierto));

    menuToggle.setAttribute(
        "aria-label",
        estaAbierto
            ? "Cerrar menú de navegación"
            : "Abrir menú de navegación"
    );

    menuToggle.textContent = estaAbierto ? "✕" : "☰";
});



async function actualizarContadorNotificaciones() {
    const contador = document.getElementById("contadorNotificaciones");
    const campanaMobile = document.getElementById("campanaNotificacionesMobile");
    const contadorMobile = document.getElementById("contadorCampanaMobile");

    // Ocultar los contadores inicialmente
    if (contador) {
        contador.hidden = true;
        contador.textContent = "";
    }

    if (campanaMobile) {
        campanaMobile.hidden = true;
    }

    if (contadorMobile) {
        contadorMobile.textContent = "";
    }

    const token = localStorage.getItem("token");

    if (!token) return;

    try {
        const respuesta = await fetch(
            "http://localhost:3000/api/notificaciones/sin-leer",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!respuesta.ok) return;

        const datos = await respuesta.json();
        const cantidad = Number(datos.cantidad) || 0;

        if (cantidad > 0) {
            const textoCantidad = cantidad > 9 ? "10+" : String(cantidad);

            // Contador del menú lateral
            if (contador) {
                contador.textContent = textoCantidad;
                contador.hidden = false;
            }

            // Campana móvil
            if (campanaMobile && contadorMobile) {
                contadorMobile.textContent = textoCantidad;
                campanaMobile.hidden = false;
            }
        }

    } catch (error) {
        console.error("Error al consultar notificaciones:", error);
    }
}


actualizarContadorNotificaciones();


/* =========================
   CONTADOR DE MENSAJES SIN LEER
========================= */

async function actualizarContadorMensajes() {
    const contador = document.getElementById("contadorMensajes");
    const token = localStorage.getItem("token");

    if (!contador) return;

    if (!token) {
        contador.hidden = true;
        contador.textContent = "";
        return;
    }

    try {
        const respuesta = await fetch(
            "http://localhost:3000/api/chat-mascotas/no-leidos",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!respuesta.ok) return;

        const datos = await respuesta.json();
        const cantidad = Number(datos.cantidad) || 0;

        contador.textContent = cantidad > 9 ? "10+" : String(cantidad);
        contador.hidden = cantidad === 0;

    } catch (error) {
        console.error("Error al consultar mensajes sin leer:", error);
    }
}

actualizarContadorMensajes();
setInterval(actualizarContadorMensajes, 15000);
