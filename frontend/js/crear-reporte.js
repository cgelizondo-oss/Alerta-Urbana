const API_USUARIOS_URL = "http://localhost:3000/api/usuarios";
const accionesVisitante = document.getElementById("accionesVisitante");
const perfilUsuario = document.getElementById("perfilUsuario");
const nombreUsuario = document.getElementById("nombreUsuario");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");
const inputUbicacion = document.getElementById("ubicacion");

// Mapa para seleccionar la ubicación del reporte
const mapa = L.map("mapa").setView([-28.4696, -65.7852], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
}).addTo(mapa);

// UBICACION DEL USUARIO
let marcadorUbicacion = null;
let ubicacionUsuario = null;

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (posicion) => {
            const latitudUsuario = posicion.coords.latitude;
            const longitudUsuario = posicion.coords.longitude;

            ubicacionUsuario = {
                latitud: latitudUsuario,
                longitud: longitudUsuario
            };

            mapa.setView([latitudUsuario, longitudUsuario], 16);

            marcadorUbicacion = L.marker([
                latitudUsuario,
                longitudUsuario
            ]).addTo(mapa);

            document.getElementById("latitud").value = latitudUsuario;
            document.getElementById("longitud").value = longitudUsuario;

            // Invalidar una confirmación anterior al cambiar la ubicación
            limpiarConfirmacionIncidencia();

            obtenerDireccion(latitudUsuario, longitudUsuario);
        },
        (error) => {
            console.error("No se pudo obtener la ubicación del usuario:", error);

            inputUbicacion.placeholder =
                "Seleccioná la ubicación manualmente en el mapa";
        }
    );
} else {
    inputUbicacion.placeholder =
        "Seleccioná la ubicación manualmente en el mapa";
}



//OBTENCION DE UNA DIRECCION CON LAS CORDENADAS
async function obtenerDireccion(latitud, longitud) {
    try {
        const respuesta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitud}&lon=${longitud}`
        );

        if (!respuesta.ok) {
            throw new Error("No se pudo obtener la dirección");
        }

        const datos = await respuesta.json();

        if (datos.display_name) {
            inputUbicacion.value = datos.display_name;
        }
    } catch (error) {
        console.error("Error al obtener la dirección:", error);

        inputUbicacion.placeholder =
            "No se pudo obtener la dirección. Ingresala manualmente";
    }
}

// MARCADOR DEL MAPA
mapa.on("click", (evento) => {
    const latitudSeleccionada = evento.latlng.lat;
    const longitudSeleccionada = evento.latlng.lng;



    if (marcadorUbicacion) {
        marcadorUbicacion.setLatLng([
            latitudSeleccionada,
            longitudSeleccionada
        ]);
    } else {
        marcadorUbicacion = L.marker([
            latitudSeleccionada,
            longitudSeleccionada
        ]).addTo(mapa);
    }

    document.getElementById("latitud").value = latitudSeleccionada;
    document.getElementById("longitud").value = longitudSeleccionada;

    // Eliminar la confirmación si cambia la ubicación
    limpiarConfirmacionIncidencia();

    obtenerDireccion(latitudSeleccionada, longitudSeleccionada);
});



async function actualizarContadorNotificaciones(token) {
    const contador = document.getElementById("contadorNotificaciones");
    const campanaMobile = document.getElementById("campanaNotificacionesMobile");
    const contadorMobile = document.getElementById("contadorCampanaMobile");

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

            // Campana del encabezado móvil
            if (campanaMobile && contadorMobile) {
                contadorMobile.textContent = textoCantidad;
                campanaMobile.hidden = false;
            }
        }

    } catch (error) {
        console.error("Error al consultar notificaciones:", error);
    }
}


/* CONTADOR DE MENSAJES SIN LEER */
async function actualizarContadorMensajes(token) {
    const contador = document.getElementById("contadorMensajes");

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


async function protegerCrearReporte() {
    const token = localStorage.getItem("token");

    // No hay token: debe iniciar sesión
    if (!token) {
        window.location.href = "login.html?motivo=reporte";
        return;
    }

    try {
        const respuesta = await fetch(`${API_USUARIOS_URL}/perfil`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        // Token vencido o inválido
        if (respuesta.status === 401 || respuesta.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");

            window.location.href = "login.html?motivo=reporte";
            return;
        }

        // Cualquier otro error tampoco permite crear el reporte
        if (!respuesta.ok) {
            console.error("No se pudo verificar la sesión.");
            window.location.href = "login.html?motivo=reporte";
            return;
        }

        const datos = await respuesta.json();
        const usuario = datos.usuario || datos;

        // Ocultar opciones de visitante
        accionesVisitante.hidden = true;

        // Mostrar usuario autenticado
        perfilUsuario.hidden = false;
        nombreUsuario.textContent = usuario.nombre || "Usuario";
        actualizarContadorNotificaciones(token);
        actualizarContadorMensajes(token);
        setInterval(() => actualizarContadorMensajes(token), 15000);

    } catch (error) {
        console.error("Error al verificar la sesión:", error);
        window.location.href = "login.html?motivo=reporte";
    }
}

protegerCrearReporte();

btnCerrarSesion.addEventListener("click", () => {
    // Eliminar los datos de autenticación
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");

    // Volver al Inicio como visitante
    window.location.href = "inicio.html";
});

/* =========================
   MENÚ MOBILE
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

const selectTipoIncidente = document.getElementById("tipoIncidente");

async function cargarTiposIncidencia() {
    try {
        const respuesta = await fetch(
            "http://localhost:3000/api/tipos-incidencia"
        );

        if (!respuesta.ok) {
            throw new Error("No se pudieron obtener los tipos de incidencia");
        }

        const tipos = await respuesta.json();

        selectTipoIncidente.innerHTML =
            '<option value="">Seleccioná un tipo de incidente</option>';

        tipos.forEach((tipo) => {
            const opcion = document.createElement("option");

            opcion.value = tipo.id_tipo;
            opcion.textContent = tipo.nombre;

            selectTipoIncidente.appendChild(opcion);
        });

    } catch (error) {
        console.error("Error al cargar tipos de incidencia:", error);

        selectTipoIncidente.innerHTML =
            '<option value="">No se pudieron cargar las categorías</option>';

        selectTipoIncidente.disabled = true;
    }
}

cargarTiposIncidencia();

const formCrearReporte = document.getElementById("formCrearReporte");
const btnCrearReporte = document.querySelector(".btn-submit-report");
const inputImagen = document.getElementById("imagen");
const mensajeReporte = document.getElementById("mensajeReporte");
const previewImagen = document.getElementById("previewImagen");
const imagenPreview = document.getElementById("imagenPreview");

const textoImagen = document.querySelector(".image-upload-text");

let urlPreviewImagen = null;

inputImagen.addEventListener("change", () => {
    const archivo = inputImagen.files[0];

    if (!archivo) {
        if (urlPreviewImagen) {
            URL.revokeObjectURL(urlPreviewImagen);
            urlPreviewImagen = null;
        }

        imagenPreview.src = "";
        previewImagen.hidden = true;
        textoImagen.textContent = "Seleccionar imagen";
        return;
    }

    const tiposPermitidos = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!tiposPermitidos.includes(archivo.type)) {
        alert("Solo se permiten imágenes JPG, JPEG, PNG o WebP");

        inputImagen.value = "";
        textoImagen.textContent = "Seleccionar imagen";

        if (urlPreviewImagen) {
            URL.revokeObjectURL(urlPreviewImagen);
            urlPreviewImagen = null;
        }

        imagenPreview.src = "";
        previewImagen.hidden = true;

        return;
    }

    const tamañoMaximo = 5 * 1024 * 1024;

    if (archivo.size > tamañoMaximo) {
        alert("La imagen no puede superar los 5 MB");

        inputImagen.value = "";
        textoImagen.textContent = "Seleccionar imagen";

        if (urlPreviewImagen) {
            URL.revokeObjectURL(urlPreviewImagen);
            urlPreviewImagen = null;
        }

        imagenPreview.src = "";
        previewImagen.hidden = true;

        return;
    }

    if (urlPreviewImagen) {
        URL.revokeObjectURL(urlPreviewImagen);
    }

    urlPreviewImagen = URL.createObjectURL(archivo);

    imagenPreview.src = urlPreviewImagen;
    previewImagen.hidden = false;

    textoImagen.textContent = archivo.name;
});


// Buscar reportes similares cerca de la ubicación seleccionada
async function buscarReportesSimilares(idTipo, latitud, longitud) {
    const token = localStorage.getItem("token");

    if (!token) {
        throw new Error("Debes iniciar sesión");
    }

    const parametros = new URLSearchParams({
        id_tipo: idTipo,
        latitud: latitud,
        longitud: longitud
    });

    const respuesta = await fetch(
        `http://localhost:3000/api/reportes/similares?${parametros}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    if (!respuesta.ok) {
        throw new Error("No se pudieron comprobar las incidencias cercanas");
    }

    const datos = await respuesta.json();

    return datos.similares || [];
}


// Quitar la confirmación de incidencia diferente
function limpiarConfirmacionIncidencia() {
    const campoConfirmacion = formCrearReporte.querySelector(
        '[name="confirmar_incidencia_diferente"]'
    );

    if (campoConfirmacion) {
        campoConfirmacion.remove();
    }
}

// Si cambia la categoría, se debe confirmar nuevamente
document.getElementById("tipoIncidente").addEventListener(
    "change",
    limpiarConfirmacionIncidencia
);

// Si cambian las coordenadas, se debe confirmar nuevamente
document.getElementById("latitud").addEventListener(
    "input",
    limpiarConfirmacionIncidencia
);

document.getElementById("longitud").addEventListener(
    "input",
    limpiarConfirmacionIncidencia
);


// Mostrar incidencias similares en el formulario
function mostrarIncidenciasSimilares(similares) {
    const contenedor = document.getElementById("incidenciasSimilares");
    const listado = document.getElementById("listaIncidenciasSimilares");

    listado.replaceChildren();

    if (similares.length === 0) {
        contenedor.hidden = true;
        return;
    }

    similares.forEach((reporte) => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "tarjeta-incidencia-similar";

        const titulo = document.createElement("h4");
        titulo.textContent = `#${reporte.id_reporte} - ${reporte.titulo}`;

        const estado = document.createElement("p");
        estado.textContent = `Estado: ${reporte.estado}`;

        const distancia = document.createElement("p");
        distancia.textContent =
            `Distancia: ${reporte.distancia_metros} metros`;

        const enlace = document.createElement("a");
        enlace.href =
            `detalle-reporte.html?id=${encodeURIComponent(reporte.id_reporte)}`;
        enlace.textContent = "Ver detalles del reporte";


        const btnSumarse = document.createElement("button");

        btnSumarse.type = "button";
        btnSumarse.className = "btn-sumarse-incidencia";
        btnSumarse.textContent = "Yo también reporto esta incidencia";

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

                btnSumarse.textContent = "✓ Ya reportaste esta incidencia";

                const confirmacion = document.createElement("p");
                confirmacion.textContent =
                    `Ahora son ${resultado.total_ciudadanos} ciudadanos asociados a esta incidencia.`;

                tarjeta.appendChild(confirmacion);

            } catch (error) {
                alert(error.message);

                btnSumarse.disabled = false;
                btnSumarse.textContent = "Yo también reporto esta incidencia";
            }
        });

        tarjeta.append(titulo, estado, distancia, enlace, btnSumarse);
        listado.appendChild(tarjeta);

    });


    // Opción para indicar que se trata de otra incidencia
    const btnOtraIncidencia = document.createElement("button");

    btnOtraIncidencia.type = "button";
    btnOtraIncidencia.className = "btn-otra-incidencia";
    btnOtraIncidencia.textContent = "Es otra incidencia diferente";


    btnOtraIncidencia.addEventListener("click", () => {
        const confirmacion = confirm(
            "¿Confirmás que se trata de una incidencia diferente a las que aparecen en la lista?"
        );

        if (!confirmacion) {
            return;
        }

        const campoConfirmacion = document.createElement("input");
        campoConfirmacion.type = "hidden";
        campoConfirmacion.name = "confirmar_incidencia_diferente";
        campoConfirmacion.value = "true";

        const campoAnterior = formCrearReporte.querySelector(
            '[name="confirmar_incidencia_diferente"]'
        );

        if (campoAnterior) {
            campoAnterior.remove();
        }

        formCrearReporte.appendChild(campoConfirmacion);

        alert(
            "Confirmaste que es otra incidencia. Ahora podés enviar el reporte."
        );
    });


    listado.appendChild(btnOtraIncidencia);


    contenedor.hidden = false;

    // Desplazarse hasta la advertencia
    contenedor.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

formCrearReporte.addEventListener("submit", async (event) => {
    event.preventDefault();

    btnCrearReporte.disabled = true;
    btnCrearReporte.textContent = "Creando reporte...";

    const datosReporte = new FormData();

    const campoConfirmacion = formCrearReporte.querySelector(
        '[name="confirmar_incidencia_diferente"]'
    );

    const esIncidenciaDiferente =
        campoConfirmacion?.value === "true";

    if (esIncidenciaDiferente) {
        datosReporte.append("confirmar_incidencia_diferente", "true");
    }

    datosReporte.append("id_tipo", document.getElementById("tipoIncidente").value);
    datosReporte.append("titulo", document.getElementById("titulo").value);
    datosReporte.append("descripcion", document.getElementById("descripcion").value);
    datosReporte.append("ubicacion", document.getElementById("ubicacion").value);

    const latitud = document.getElementById("latitud").value;
    const longitud = document.getElementById("longitud").value;

    if (latitud && longitud) {
        datosReporte.append("latitud", latitud);
        datosReporte.append("longitud", longitud);
    }

    if (inputImagen.files.length > 0) {
        datosReporte.append("imagen", inputImagen.files[0]);
    }

    try {
        const token = localStorage.getItem("token");

        if (!token) {
            window.location.href = "login.html?motivo=reporte";
            return;
        }

        // Comprobar si ya existen incidencias similares
        const idTipoSeleccionado =
            document.getElementById("tipoIncidente").value;

        if (idTipoSeleccionado && latitud && longitud) {

            const similares = await buscarReportesSimilares(
                idTipoSeleccionado,
                latitud,
                longitud
            );

            if (similares.length > 0 && !esIncidenciaDiferente) {
                mostrarIncidenciasSimilares(similares);
                return;
            }

            // Ocultar advertencias anteriores si ya no hay coincidencias
            mostrarIncidenciasSimilares([]);
        }


        const respuesta = await fetch("http://localhost:3000/api/reportes", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: datosReporte
        });

        if (respuesta.status === 401 || respuesta.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");

            window.location.href = "login.html?motivo=reporte";
            return;
        }

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            mensajeReporte.hidden = false;
            mensajeReporte.textContent = "✓ Reporte creado correctamente";

            mensajeReporte.classList.remove("mensaje-error");
            mensajeReporte.classList.add("mensaje-exito");

            formCrearReporte.reset();
            formCrearReporte.querySelector(
                '[name="confirmar_incidencia_diferente"]'
            )?.remove();

            mostrarIncidenciasSimilares([]);
            textoImagen.textContent = "Seleccionar imagen";

            if (urlPreviewImagen) {
                URL.revokeObjectURL(urlPreviewImagen);
                urlPreviewImagen = null;
            }

            imagenPreview.src = "";
            previewImagen.hidden = true;

            if (ubicacionUsuario && marcadorUbicacion) {
                const { latitud, longitud } = ubicacionUsuario;

                mapa.setView([latitud, longitud], 16);

                marcadorUbicacion.setLatLng([
                    latitud,
                    longitud
                ]);

                document.getElementById("latitud").value = latitud;
                document.getElementById("longitud").value = longitud;

                obtenerDireccion(latitud, longitud);
            }

            setTimeout(() => {
                mensajeReporte.hidden = true;
            }, 4000);
        } else {
            mensajeReporte.hidden = false;
            mensajeReporte.textContent =
                resultado.mensaje || "No se pudo crear el reporte";

            mensajeReporte.classList.remove("mensaje-exito");
            mensajeReporte.classList.add("mensaje-error");

            setTimeout(() => {
                mensajeReporte.hidden = true;
            }, 4000);
        }

    } catch (error) {
        console.error("Error al enviar el reporte:", error);

        mensajeReporte.hidden = false;
        mensajeReporte.textContent = "No se pudo conectar con el servidor";

        mensajeReporte.classList.remove("mensaje-exito");
        mensajeReporte.classList.add("mensaje-error");

        setTimeout(() => {
            mensajeReporte.hidden = true;
        }, 4000);
    } finally {
        btnCrearReporte.disabled = false;
        btnCrearReporte.textContent = "Crear reporte";
    }
});