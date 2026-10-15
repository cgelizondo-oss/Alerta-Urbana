// =========================
// MAPA DE INCIDENCIAS
// =========================

// Coordenadas iniciales: San Fernando del Valle de Catamarca
const mapaIncidencias = L.map("mapaIncidencias").setView(
    [-28.4696, -65.7852],
    13
);

// Cargar el mapa de OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
}).addTo(mapaIncidencias);


// =========================
// CARGAR REPORTES EN EL MAPA
// =========================

// Guardar los reportes y sus marcadores para aplicar filtros
let marcadoresReportes = [];

// Contenedor donde mostraremos los reportes
const listaReportesMapa = document.getElementById("listaReportesMapa");

async function cargarReportesMapa() {
    try {
        const token = localStorage.getItem("token");

        if (!token) {
            console.warn("No hay una sesión iniciada.");
            return;
        }

        const respuesta = await fetch(
            "http://localhost:3000/api/reportes/mapa",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los reportes");
        }

        const datos = await respuesta.json();
        const reportes = datos.reportes || [];



        const coordenadas = [];

        reportes.forEach((reporte) => {
            const latitud = Number(reporte.latitud);
            const longitud = Number(reporte.longitud);

            if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
                return;
            }

            const marcador = L.marker([latitud, longitud])
                .addTo(mapaIncidencias);

            // Crear los elementos de la tarjeta sin insertar HTML del usuario
            const tarjeta = document.createElement("div");
            tarjeta.className = "popup-incidencia";

            const titulo = document.createElement("h3");
            titulo.textContent = reporte.titulo;

            const autor = document.createElement("p");
            autor.textContent = `👤 Reportado por: ${reporte.nombre_usuario}`;

            const categoria = document.createElement("p");
            categoria.textContent = `Categoría: ${reporte.tipo_incidencia}`;

            const estado = document.createElement("p");
            estado.textContent = `Estado: ${reporte.estado}`;

            const fecha = document.createElement("p");
            fecha.textContent = `Fecha: ${new Date(reporte.fecha_creacion).toLocaleDateString("es-AR")}`;

            const ubicacion = document.createElement("p");
            ubicacion.textContent = `Ubicación: ${reporte.ubicacion}`;


            // Cantidad de ciudadanos asociados a la incidencia
            const ciudadanos = document.createElement("p");

            const totalCiudadanos = Number(reporte.total_ciudadanos) || 1;

            ciudadanos.textContent =
                `👥 ${totalCiudadanos} ${totalCiudadanos === 1
                    ? "ciudadano reportó"
                    : "ciudadanos reportaron"
                } esta incidencia`;


            const descripcion = document.createElement("p");
            descripcion.textContent = reporte.descripcion;

            const enlace = document.createElement("a");
            enlace.href = `detalle-reporte.html?id=${encodeURIComponent(reporte.id_reporte)}`;
            enlace.textContent = "Ver detalles del reporte";
            enlace.className = "popup-ver-detalle";


            // Botón para sumarse a una incidencia existente
            const btnSumarse = document.createElement("button");

            btnSumarse.type = "button";
            btnSumarse.className = "popup-ver-detalle";
            btnSumarse.textContent = "👥 Yo también reporto esta incidencia";


            // Comprobar si el reporte está activo
            const reporteActivo = [1, 2, 3].includes(Number(reporte.id_estado));

            // Comprobar si el usuario ya reportó esta incidencia
            const yaReportado = reporte.ya_reportado === true;

            if (!reporteActivo) {
                btnSumarse.disabled = true;
                btnSumarse.textContent = "Esta incidencia ya no está activa";

            } else if (yaReportado) {
                btnSumarse.disabled = true;
                btnSumarse.textContent = "✓ Ya reportaste esta incidencia";
            }


            btnSumarse.addEventListener("click", async () => {
                const token = localStorage.getItem("token");

                if (!token) {
                    window.location.href = "login.html?motivo=reporte";
                    return;
                }

                btnSumarse.disabled = true;
                btnSumarse.textContent = "Registrando...";

                try {
                    const respuesta = await fetch(
                        `http://localhost:3000/api/reportes/${reporte.id_reporte}/sumarse`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        }
                    );

                    const resultado = await respuesta.json();

                    if (!respuesta.ok) {
                        throw new Error(
                            resultado.mensaje || "No se pudo registrar tu participación"
                        );
                    }

                    // Actualizar el contador sin recargar la página
                    reporte.total_ciudadanos = resultado.total_ciudadanos;

                    const total = Number(resultado.total_ciudadanos);

                    ciudadanos.textContent =
                        `👥 ${total} ${total === 1
                            ? "ciudadano reportó"
                            : "ciudadanos reportaron"
                        } esta incidencia`;

                    btnSumarse.textContent = "✓ Ya reportaste esta incidencia";

                    // Actualizar también el listado inferior
                    aplicarFiltrosMapa();

                } catch (error) {
                    alert(error.message);

                    btnSumarse.disabled = false;
                    btnSumarse.textContent = "👥 Yo también reporto esta incidencia";
                }
            });


            // Opción para denunciar la incidencia
            const btnDenunciar = document.createElement("a");

            btnDenunciar.href =
                `detalle-reporte.html?id=${encodeURIComponent(reporte.id_reporte)}`;

            btnDenunciar.textContent = "🚩 Denunciar reporte";
            btnDenunciar.className = "popup-denunciar";

            // No mostrar el botón en reportes propios
            const usuarioActual = JSON.parse(
                localStorage.getItem("usuario") || "null"
            );

            const esPropietario =
                usuarioActual &&
                Number(usuarioActual.id_usuario) === Number(reporte.id_usuario);



            tarjeta.append(
                titulo,
                autor,
                categoria,
                estado,
                fecha,
                ubicacion,
                ciudadanos,
                descripcion,
                enlace,
                btnSumarse
            );

            if (!esPropietario) {
                tarjeta.appendChild(btnDenunciar);
            }





            const esMobile = window.innerWidth <= 600;

            marcador.bindPopup(tarjeta, {
                maxWidth: esMobile ? 240 : 380,
                minWidth: esMobile ? 200 : 280,
                maxHeight: esMobile ? 200 : 650,
                autoPan: true,
                keepInView: true,
                className: "popup-incidencia"
            });




            // Asociar cada marcador con los datos de su reporte
            marcadoresReportes.push({
                reporte: reporte,
                marcador: marcador
            });


            coordenadas.push([latitud, longitud]);
        });

        // Mostrar el listado y aplicar los filtros actuales
        aplicarFiltrosMapa();

    } catch (error) {
        console.error("Error al cargar el mapa:", error);
    }
}

cargarReportesMapa();


// =========================
// SESIÓN DEL USUARIO
// =========================

const accionesVisitante = document.getElementById("accionesVisitante");
const perfilUsuario = document.getElementById("perfilUsuario");
const nombreUsuario = document.getElementById("nombreUsuario");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");

async function verificarSesionMapa() {
    const token = localStorage.getItem("token");

    // Si no hay sesión, mostrar opciones de visitante
    if (!token) {
        accionesVisitante.hidden = false;
        perfilUsuario.hidden = true;
        return;
    }

    try {
        const respuesta = await fetch(
            "http://localhost:3000/api/usuarios/perfil",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (respuesta.status === 401 || respuesta.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");

            accionesVisitante.hidden = false;
            perfilUsuario.hidden = true;
            return;
        }

        if (!respuesta.ok) {
            throw new Error("No se pudo verificar la sesión");
        }

        const datos = await respuesta.json();
        const usuario = datos.usuario || datos;

        accionesVisitante.hidden = true;
        perfilUsuario.hidden = false;
        nombreUsuario.textContent = usuario.nombre || "Usuario";

    } catch (error) {
        console.error("Error al verificar la sesión:", error);
    }
}

verificarSesionMapa();

// Cerrar sesión
btnCerrarSesion.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");

    window.location.href = "inicio.html";
});


// =========================
// CARGAR CATEGORÍAS DEL FILTRO
// =========================

const filtroCategoria = document.getElementById("filtroCategoria");

async function cargarCategoriasMapa() {
    try {
        const respuesta = await fetch(
            "http://localhost:3000/api/tipos-incidencia"
        );

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las categorías");
        }

        const categorias = await respuesta.json();

        // Mantener la opción "Todas las categorías"
        filtroCategoria.replaceChildren(
            new Option("Todas las categorías", "")
        );

        categorias.forEach((categoria) => {
            const opcion = new Option(
                categoria.nombre,
                categoria.id_tipo
            );

            filtroCategoria.appendChild(opcion);
        });

    } catch (error) {
        console.error("Error al cargar las categorías:", error);

        filtroCategoria.replaceChildren(
            new Option("No se pudieron cargar las categorías", "")
        );

        filtroCategoria.disabled = true;
    }
}

cargarCategoriasMapa();


// =========================
// FILTRAR MARCADORES POR CATEGORÍA
// =========================



function aplicarFiltrosMapa() {
    const categoriaSeleccionada = filtroCategoria.value;
    const estadoSeleccionado = filtroEstado.value;

    const reportesFiltrados = [];

    marcadoresReportes.forEach(({ reporte, marcador }) => {

        const coincideCategoria =
            categoriaSeleccionada === "" ||
            String(reporte.id_tipo) === categoriaSeleccionada;

        const coincideEstado =
            estadoSeleccionado === "" ||
            String(reporte.id_estado) === estadoSeleccionado;

        if (coincideCategoria && coincideEstado) {

            // Mostrar marcador
            if (!mapaIncidencias.hasLayer(marcador)) {
                marcador.addTo(mapaIncidencias);
            }

            // Agregar reporte al listado
            reportesFiltrados.push(reporte);

        } else {

            // Ocultar marcador
            if (mapaIncidencias.hasLayer(marcador)) {
                mapaIncidencias.removeLayer(marcador);
            }
        }
    });

    // Actualizar el listado con los mismos reportes visibles
    mostrarListadoReportes(reportesFiltrados);
}



// =========================
// FILTRO POR ESTADO
// =========================

const filtroEstado = document.getElementById("filtroEstado");

// Estados registrados en PostgreSQL
const estadosReporte = [
    { id: 1, nombre: "Pendiente" },
    { id: 2, nombre: "En revisión" },
    { id: 3, nombre: "En proceso" },
    { id: 4, nombre: "Resuelto" },
    { id: 5, nombre: "Abandonado" },
    { id: 6, nombre: "Rechazado" }
];

estadosReporte.forEach((estado) => {
    filtroEstado.appendChild(
        new Option(estado.nombre, estado.id)
    );
});

filtroEstado.addEventListener("change", aplicarFiltrosMapa);


// Ejecutar el filtro cada vez que cambia la categoría
filtroCategoria.addEventListener("change", aplicarFiltrosMapa);


// =========================
// UBICACIÓN ACTUAL DEL USUARIO
// =========================

let marcadorUsuario = null;

function centrarMapaEnUsuario() {

    if (!navigator.geolocation) {
        console.warn("Tu navegador no permite obtener la ubicación.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (posicion) => {

            const latitud = posicion.coords.latitude;
            const longitud = posicion.coords.longitude;

            // Centrar el mapa en la ubicación del usuario
            mapaIncidencias.setView([latitud, longitud], 16);

            // Mostrar un marcador diferente para identificar al usuario
            if (marcadorUsuario) {
                marcadorUsuario.setLatLng([latitud, longitud]);
            } else {
                marcadorUsuario = L.circleMarker(
                    [latitud, longitud],
                    {
                        radius: 9,
                        color: "#ffffff",
                        weight: 3,
                        fillColor: "#2563eb",
                        fillOpacity: 1
                    }
                ).addTo(mapaIncidencias);

                marcadorUsuario.bindPopup("📍 Estás aquí");
            }
        },

        (error) => {
            console.warn("No se pudo obtener tu ubicación:", error.message);
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

centrarMapaEnUsuario();


// =========================
// LISTADO DE REPORTES DEL MAPA
// =========================

function mostrarListadoReportes(reportes) {

    // Limpiar el contenido anterior
    listaReportesMapa.replaceChildren();

    if (reportes.length === 0) {
        const mensaje = document.createElement("p");
        mensaje.className = "empty-message";
        mensaje.textContent = "No hay reportes para mostrar.";

        listaReportesMapa.appendChild(mensaje);
        return;
    }

    reportes.forEach((reporte) => {

        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-reporte-mapa";

        const titulo = document.createElement("h3");
        titulo.textContent = `#${reporte.id_reporte} - ${reporte.titulo}`;

        const categoria = document.createElement("p");
        categoria.textContent = `Categoría: ${reporte.tipo_incidencia}`;

        const estado = document.createElement("p");
        estado.textContent = `Estado: ${reporte.estado}`;

        const fecha = document.createElement("p");
        fecha.textContent =
            `Fecha: ${new Date(reporte.fecha_creacion).toLocaleDateString("es-AR")}`;

        // Botón para localizar la incidencia en el mapa
        const btnVerEnMapa = document.createElement("button");
        btnVerEnMapa.type = "button";
        btnVerEnMapa.className = "enlace-reporte-mapa";
        btnVerEnMapa.textContent = "📍 Ver en el mapa";

        btnVerEnMapa.addEventListener("click", () => {
            const elemento = marcadoresReportes.find(
                (item) => Number(item.reporte.id_reporte) === Number(reporte.id_reporte)
            );

            if (!elemento) return;

            const { marcador } = elemento;

            // Centrar el mapa en la incidencia
            mapaIncidencias.setView(marcador.getLatLng(), 17);

            // Abrir la información del reporte
            marcador.openPopup();

            // Desplazarse hasta el mapa
            document.getElementById("mapaIncidencias").scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        });

        const ciudadanos = document.createElement("p");

        const totalCiudadanos = Number(reporte.total_ciudadanos) || 1;

        ciudadanos.textContent =
            `👥 ${totalCiudadanos} ${totalCiudadanos === 1
                ? "ciudadano reportó"
                : "ciudadanos reportaron"
            } esta incidencia`;

        const enlace = document.createElement("a");
        enlace.href =
            `detalle-reporte.html?id=${encodeURIComponent(reporte.id_reporte)}`;
        enlace.textContent = "Ver detalles";
        enlace.className = "enlace-reporte-mapa";

        tarjeta.append(
            titulo,
            categoria,
            estado,
            fecha,
            ciudadanos,
            btnVerEnMapa,
            enlace
        );

        listaReportesMapa.appendChild(tarjeta);
    });
}


// Menú hamburguesa para dispositivos móviles
const menuToggle = document.getElementById("menuToggle");
const menuMobile = document.getElementById("menuMobile");

if (menuToggle && menuMobile) {
    menuToggle.addEventListener("click", () => {
        const estaAbierto = menuMobile.classList.toggle("menu-open");

        menuToggle.setAttribute("aria-expanded", String(estaAbierto));
    });
}





