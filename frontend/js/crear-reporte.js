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

    obtenerDireccion(latitudSeleccionada, longitudSeleccionada);
});

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

formCrearReporte.addEventListener("submit", async (event) => {
    event.preventDefault();

    btnCrearReporte.disabled = true;
    btnCrearReporte.textContent = "Creando reporte...";

    const datosReporte = new FormData();

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
    }finally {
        btnCrearReporte.disabled = false;
        btnCrearReporte.textContent = "Crear reporte";
    }
});