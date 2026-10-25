
const API_URL = "http://localhost:3000/api/mascotas";
const API_USUARIOS_URL = "http://localhost:3000/api/usuarios";


async function protegerMascotas() {
    const token = localStorage.getItem("token");

    const accionesVisitante = document.getElementById("accionesVisitante");
    const perfilUsuario = document.getElementById("perfilUsuario");
    const nombreUsuario = document.getElementById("nombreUsuario");

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

        const datos = await respuesta.json();
        const usuario = datos.usuario || datos;

        // Ocultar los botones de visitante
        if (accionesVisitante) {
            accionesVisitante.hidden = true;
        }

        // Mostrar el perfil del usuario
        if (perfilUsuario) {
            perfilUsuario.hidden = false;
        }

        if (nombreUsuario) {
            nombreUsuario.textContent = usuario.nombre || "Usuario";
        }

        return true;

    } catch (error) {
        console.error("Error al verificar la sesión:", error);
        window.location.href = "login.html?motivo=reporte";
        return false;
    }
}

const listaMascotas = document.getElementById("listaMascotas");
const formularioContenedor = document.getElementById("formularioContenedor");
const formulario = document.getElementById("formMascota");
const mensaje = document.getElementById("mensajeMascota");

const inputFechaPerdida = document.getElementById("fecha_perdida");

const hoy = new Date();
const fechaHoy = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0")
].join("-");

inputFechaPerdida.max = fechaHoy;


const inputImagen = document.getElementById("imagen");
const vistaPreviaContenedor = document.getElementById("vistaPreviaContenedor");
const vistaPreviaImagen = document.getElementById("vistaPreviaImagen");
const botonQuitarImagen = document.getElementById("quitarImagen");

let urlVistaPrevia = null;

inputImagen.addEventListener("change", () => {
    const archivo = inputImagen.files[0];

    if (urlVistaPrevia) {
        URL.revokeObjectURL(urlVistaPrevia);
        urlVistaPrevia = null;
    }

    if (!archivo) {
        vistaPreviaImagen.removeAttribute("src");
        vistaPreviaContenedor.hidden = true;
        return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
        inputImagen.value = "";
        vistaPreviaImagen.removeAttribute("src");
        vistaPreviaContenedor.hidden = true;
        mensaje.hidden = false;
        mensaje.className = "mensaje-error";
        mensaje.textContent = "Seleccioná una imagen JPG, PNG o WebP.";
        return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
        inputImagen.value = "";
        vistaPreviaImagen.removeAttribute("src");
        vistaPreviaContenedor.hidden = true;
        mensaje.hidden = false;
        mensaje.className = "mensaje-error";
        mensaje.textContent = "La imagen no puede superar los 5 MB.";
        return;
    }

    urlVistaPrevia = URL.createObjectURL(archivo);
    vistaPreviaImagen.src = urlVistaPrevia;
    vistaPreviaContenedor.hidden = false;
    mensaje.hidden = true;
});

botonQuitarImagen.addEventListener("click", () => {
    inputImagen.value = "";

    if (urlVistaPrevia) {
        URL.revokeObjectURL(urlVistaPrevia);
        urlVistaPrevia = null;
    }

    vistaPreviaImagen.removeAttribute("src");
    vistaPreviaContenedor.hidden = true;
});


// =========================
// MAPA PARA UBICAR MASCOTAS
// =========================

const inputUbicacion = document.getElementById("ubicacion");
const inputLatitud = document.getElementById("latitudMascota");
const inputLongitud = document.getElementById("longitudMascota");

const mapaMascota = L.map("mapaMascota").setView([-28.4696, -65.7852], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
}).addTo(mapaMascota);

let marcadorMascota = null;

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (posicion) => {
            const latitud = posicion.coords.latitude;
            const longitud = posicion.coords.longitude;

            mapaMascota.setView([latitud, longitud], 16);

            marcadorMascota = L.marker([latitud, longitud])
                .addTo(mapaMascota);

            inputLatitud.value = latitud;
            inputLongitud.value = longitud;

            obtenerDireccionMascota(latitud, longitud);
        },
        (error) => {
            console.warn("No se pudo obtener tu ubicación:", error.message);
        }
    );
}

async function obtenerDireccionMascota(latitud, longitud) {
    try {
        const respuesta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitud}&lon=${longitud}`
        );

        if (!respuesta.ok) {
            throw new Error("No se pudo obtener la dirección");
        }

        const datos = await respuesta.json();

        inputUbicacion.value =
            datos.display_name || `${latitud}, ${longitud}`;
    } catch (error) {
        console.error("Error al obtener la dirección:", error);
    }
}

mapaMascota.on("click", async (evento) => {
    const latitud = evento.latlng.lat;
    const longitud = evento.latlng.lng;

    if (marcadorMascota) {
        marcadorMascota.setLatLng([latitud, longitud]);
    } else {
        marcadorMascota = L.marker([latitud, longitud]).addTo(mapaMascota);
    }

    inputLatitud.value = latitud;
    inputLongitud.value = longitud;
    inputUbicacion.value = "Buscando dirección...";

    try {
        const respuesta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitud}&lon=${longitud}`
        );

        if (!respuesta.ok) {
            throw new Error("No se pudo obtener la dirección");
        }

        const datos = await respuesta.json();

        inputUbicacion.value = datos.display_name || `${latitud}, ${longitud}`;
    } catch (error) {
        console.error("Error al obtener la dirección:", error);
        inputUbicacion.value = `${latitud}, ${longitud}`;
    }
});

document.getElementById("btnMostrarFormulario").addEventListener("click", () => {
    formularioContenedor.hidden = false;

    // Esperar a que el formulario se muestre y recalcular el tamaño del mapa.
    requestAnimationFrame(() => {
        mapaMascota.invalidateSize();
    });

    formularioContenedor.scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnCancelarFormulario").addEventListener("click", () => {
    formulario.reset();

    if (urlVistaPrevia) {
        URL.revokeObjectURL(urlVistaPrevia);
        urlVistaPrevia = null;
    }

    vistaPreviaImagen.removeAttribute("src");
    vistaPreviaContenedor.hidden = true;

    formularioContenedor.hidden = true;
    mensaje.hidden = true;
});


async function contactarDueno(idMascota, boton) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    boton.disabled = true;
    boton.textContent = "Abriendo chat...";

    try {
        const respuesta = await fetch(
            "http://localhost:3000/api/chat-mascotas/conversaciones",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    id_mascota: idMascota
                })
            }
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.mensaje || "No se pudo iniciar la conversación."
            );
        }

        const conversacion = resultado.conversacion
            || resultado.conversacion_mascota
            || resultado;

        if (!conversacion.id_conversacion) {
            throw new Error("El servidor no devolvió el ID de la conversación.");
        }

        window.location.href =
            `chats.html?conversacion=${conversacion.id_conversacion}`;

    } catch (error) {
        console.error("Error al iniciar el chat:", error);
        alert(error.message || "No se pudo iniciar el chat.");
        boton.disabled = false;
        boton.textContent = "💬 Contactar al dueño";
    }
}

async function cargarMascotas() {
    try {
        const respuesta = await fetch(API_URL);

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las publicaciones.");
        }

        const mascotas = await respuesta.json();

        listaMascotas.replaceChildren();

        if (mascotas.length === 0) {
            const aviso = document.createElement("p");
            aviso.textContent = "Todavía no hay mascotas publicadas.";
            listaMascotas.appendChild(aviso);
            return;
        }

        mascotas.forEach((mascota) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "mascota-card";

            if (mascota.foto) {
                const imagen = document.createElement("img");
                imagen.src = `http://localhost:3000${mascota.foto}`;
                imagen.alt = `Foto de ${mascota.nombre}`;
                imagen.loading = "lazy";
                tarjeta.appendChild(imagen);
            }

            const contenido = document.createElement("div");
            contenido.className = "mascota-card-contenido";

            const titulo = document.createElement("h3");
            titulo.textContent = mascota.nombre;

            const tipo = document.createElement("p");
            tipo.textContent = `Animal: ${mascota.tipo_animal}`;

            const descripcion = document.createElement("p");
            descripcion.textContent = mascota.descripcion;

            const ubicacion = document.createElement("p");
            ubicacion.textContent = `Última ubicación: ${mascota.ubicacion}`;

            const fecha = document.createElement("p");
            fecha.textContent = `Fecha de pérdida: ${formatearFecha(mascota.fecha_perdida)}`;

            const estado = document.createElement("span");
            estado.className = "mascota-estado";
            estado.textContent = mascota.estado || "Perdida";


            contenido.append(titulo, tipo, descripcion, ubicacion, fecha, estado);

            const botonChat = document.createElement("button");
            botonChat.type = "button";
            botonChat.className = "btn-contactar-dueno";
            botonChat.textContent = "💬 Contactar al dueño";

            botonChat.addEventListener("click", () => {
                contactarDueno(mascota.id_mascota, botonChat);
            });

            tarjeta.appendChild(contenido);
            tarjeta.appendChild(botonChat);
            listaMascotas.appendChild(tarjeta);

        });
    } catch (error) {
        console.error("Error al cargar mascotas:", error);
        listaMascotas.textContent =
            "No se pudieron cargar las mascotas. Verificá que el servidor esté funcionando.";
    }
}

function formatearFecha(fecha) {
    if (!fecha) return "No especificada";

    const fechaLimpia = String(fecha).slice(0, 10);
    const [anio, mes, dia] = fechaLimpia.split("-");

    return `${dia}/${mes}/${anio}`;
}


formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!inputUbicacion.value.trim() ||
        !inputLatitud.value ||
        !inputLongitud.value) {

        mensaje.hidden = false;
        mensaje.className = "mensaje-error";
        mensaje.textContent =
            "Marcá en el mapa la última ubicación conocida de la mascota.";
        return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
        mensaje.hidden = false;
        mensaje.className = "mensaje-error";
        mensaje.textContent = "Iniciá sesión para publicar una mascota.";
        return;
    }

    const botonPublicar = formulario.querySelector('button[type="submit"]');

    // Evitar envíos duplicados.
    if (botonPublicar.disabled) return;

    botonPublicar.disabled = true;
    mensaje.hidden = false;
    mensaje.className = "";
    mensaje.textContent = "Publicando mascota...";

    try {
        const datos = new FormData(formulario);

        const respuesta = await fetch(API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: datos
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.mensaje || "No se pudo publicar la mascota."
            );
        }

        mensaje.className = "mensaje-exito";
        mensaje.textContent = "¡Mascota publicada correctamente!";

        formulario.reset();

        if (urlVistaPrevia) {
            URL.revokeObjectURL(urlVistaPrevia);
            urlVistaPrevia = null;
        }

        vistaPreviaImagen.removeAttribute("src");
        vistaPreviaContenedor.hidden = true;

        await cargarMascotas();

    } catch (error) {
        console.error("Error al publicar mascota:", error);
        mensaje.className = "mensaje-error";
        mensaje.textContent =
            error.message || "Ocurrió un error al publicar.";

    } finally {
        // Habilitar nuevamente el botón, haya éxito o error.
        botonPublicar.disabled = false;
    }
});


/* =========================
   CONTADORES DE NAVEGACIÓN
========================= */

async function actualizarContadoresNavegacion() {
    const token = localStorage.getItem("token");

    const contadorMensajes = document.getElementById("contadorMensajes");
    const contadorNotificaciones = document.getElementById("contadorNotificaciones");

    if (!token) {
        if (contadorMensajes) {
            contadorMensajes.hidden = true;
            contadorMensajes.textContent = "";
        }

        if (contadorNotificaciones) {
            contadorNotificaciones.hidden = true;
            contadorNotificaciones.textContent = "";
        }

        return;
    }

    const consultas = [
        {
            url: "http://localhost:3000/api/chat-mascotas/no-leidos",
            contador: contadorMensajes
        },
        {
            url: "http://localhost:3000/api/notificaciones/sin-leer",
            contador: contadorNotificaciones
        }
    ];

    for (const consulta of consultas) {
        if (!consulta.contador) continue;

        try {
            const respuesta = await fetch(consulta.url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!respuesta.ok) continue;

            const datos = await respuesta.json();
            const cantidad = Number(datos.cantidad) || 0;

            consulta.contador.textContent =
                cantidad > 9 ? "10+" : String(cantidad);

            consulta.contador.hidden = cantidad === 0;

        } catch (error) {
            console.error("Error al actualizar un contador:", error);
        }
    }
}

actualizarContadoresNavegacion();

setInterval(actualizarContadoresNavegacion, 15000);


(async () => {
    const sesionValida = await protegerMascotas();

    if (!sesionValida) return;

    await cargarMascotas();
})();
