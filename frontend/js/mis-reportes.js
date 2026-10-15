const API_REPORTES = "http://localhost:3000/api/reportes/mis-reportes";

const listaMisReportes = document.getElementById("listaMisReportes");

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

cargarMisReportes();

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