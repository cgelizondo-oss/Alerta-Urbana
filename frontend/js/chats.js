const API_USUARIOS_URL = "http://localhost:3000/api/usuarios";
const API_CHAT_URL = "http://localhost:3000/api/chat-mascotas";

const accionesVisitante = document.getElementById("accionesVisitante");
const perfilUsuario = document.getElementById("perfilUsuario");
const nombreUsuario = document.getElementById("nombreUsuario");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");

const listaConversaciones = document.getElementById("listaConversaciones");
const chatLayout = document.querySelector(".chat-layout");
const chatVacio = document.getElementById("chatVacio");
const chatActivo = document.getElementById("chatActivo");
const nombreContacto = document.getElementById("nombreContacto");
const nombreMascotaChat = document.getElementById("nombreMascotaChat");
const mensajesChat = document.getElementById("mensajesChat");
const formMensaje = document.getElementById("formMensaje");
const contenidoMensaje = document.getElementById("contenidoMensaje");

let tokenActual = null;
let usuarioActual = null;
let conversacionActual = null;
let enviandoMensaje = false;


//SESIÓN
async function comprobarSesionChat() {
    tokenActual = localStorage.getItem("token");

    if (!tokenActual) {
        mostrarVisitanteChat();
        return;
    }

    try {
        const respuesta = await fetch(`${API_USUARIOS_URL}/perfil`, {
            headers: {
                Authorization: `Bearer ${tokenActual}`
            }
        });

        if (respuesta.status === 401 || respuesta.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");
            tokenActual = null;

            mostrarVisitanteChat();
            return;
        }

        if (!respuesta.ok) {
            throw new Error("No se pudo comprobar la sesión");
        }

        const datos = await respuesta.json();
        usuarioActual = datos.usuario || datos;

        accionesVisitante.hidden = true;
        perfilUsuario.hidden = false;
        nombreUsuario.textContent = usuarioActual.nombre || "Usuario";

        await cargarConversaciones();

    } catch (error) {
        console.error("Error al comprobar la sesión:", error);
        mostrarErrorLista("No se pudo comprobar tu sesión. Recargá la página.");
    }
}


function mostrarVisitanteChat() {
    accionesVisitante.hidden = false;
    perfilUsuario.hidden = true;

    listaConversaciones.replaceChildren();

    const mensaje = document.createElement("p");
    mensaje.className = "estado-chat";
    mensaje.textContent = "Iniciá sesión para ver tus conversaciones.";

    listaConversaciones.appendChild(mensaje);

    chatVacio.hidden = false;
    chatActivo.hidden = true;
    conversacionActual = null;
}

//SOLICITUDES AL BACKEND
async function solicitarAPI(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        headers: {
            ...(opciones.headers || {}),
            Authorization: `Bearer ${tokenActual}`
        }
    });

    if (respuesta.status === 401 || respuesta.status === 403) {
        throw new Error("Tu sesión venció. Iniciá sesión nuevamente.");
    }

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        throw new Error(datos.mensaje || "Ocurrió un error en el servidor.");
    }

    return datos;
}

//LISTA DE CONVERSACIONES

async function cargarConversaciones() {
    listaConversaciones.replaceChildren();

    const cargando = document.createElement("p");
    cargando.className = "estado-chat";
    cargando.textContent = "Cargando conversaciones...";
    listaConversaciones.appendChild(cargando);

    try {
        const conversaciones = await solicitarAPI(
            `${API_CHAT_URL}/conversaciones`
        );

        listaConversaciones.replaceChildren();

        if (!Array.isArray(conversaciones) || conversaciones.length === 0) {
            const vacio = document.createElement("p");
            vacio.className = "estado-chat";
            vacio.textContent =
                "Todavía no tenés conversaciones. Podés contactar al dueño desde un aviso de mascota perdida.";

            listaConversaciones.appendChild(vacio);
            return;
        }

        conversaciones.forEach(conversacion => {
            listaConversaciones.appendChild(
                crearElementoConversacion(conversacion)
            );
        });

    } catch (error) {
        console.error("Error al cargar conversaciones:", error);
        mostrarErrorLista(error.message);
    }
}


function crearElementoConversacion(conversacion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "conversacion-item";

    if (
        conversacionActual &&
        Number(conversacionActual.id_conversacion) ===
        Number(conversacion.id_conversacion)
    ) {
        boton.classList.add("conversacion-activa");
    }

    const avatar = document.createElement("span");
    avatar.className = "conversacion-avatar";
    avatar.textContent = "🐾";

    const informacion = document.createElement("span");
    informacion.className = "conversacion-info";

    const titulo = document.createElement("strong");
    titulo.className = "conversacion-mascota";
    titulo.textContent = conversacion.nombre_mascota || "Mascota sin nombre";

    const ultimoMensaje = document.createElement("span");
    ultimoMensaje.className = "conversacion-ultimo-mensaje";
    ultimoMensaje.textContent =
        conversacion.ultimo_mensaje || "Todavía no hay mensajes";

    const fecha = document.createElement("small");
    fecha.className = "conversacion-fecha";

    const fechaReferencia =
        conversacion.fecha_ultimo_mensaje || conversacion.fecha_creacion;

    fecha.textContent = formatearFechaCorta(fechaReferencia);

    informacion.append(titulo, ultimoMensaje);
    boton.append(avatar, informacion, fecha);

    boton.addEventListener("click", () => {
        abrirConversacion(conversacion);
    });

    return boton;
}


function formatearFechaCorta(fecha) {
    if (!fecha) return "";

    const fechaMensaje = new Date(fecha);

    if (Number.isNaN(fechaMensaje.getTime())) return "";

    return fechaMensaje.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit"
    });
}


function mostrarErrorLista(mensaje) {
    listaConversaciones.replaceChildren();

    const error = document.createElement("p");
    error.className = "estado-chat";
    error.textContent = mensaje;

    listaConversaciones.appendChild(error);
}

//ABRIR UNA CONVERSACIÓN
async function abrirConversacion(conversacion) {
    conversacionActual = conversacion;

    nombreContacto.textContent = "Conversación";
    nombreMascotaChat.textContent =
        `Mascota: ${conversacion.nombre_mascota || "Sin nombre"}`;

    chatVacio.hidden = true;
    chatActivo.hidden = false;

    if (chatLayout) {
        chatLayout.classList.add("chat-abierto");
    }

    // Actualizar la conversación seleccionada en la lista.
    document.querySelectorAll(".conversacion-item").forEach(boton => {
        boton.classList.remove("conversacion-activa");
    });

    const botones = [...document.querySelectorAll(".conversacion-item")];
    const indice = botones.findIndex(boton =>
        boton.querySelector(".conversacion-mascota")?.textContent ===
        (conversacion.nombre_mascota || "Mascota sin nombre")
    );

    // La selección visual también se actualiza al reconstruir la lista.
    if (indice >= 0) {
        botones[indice].classList.add("conversacion-activa");
    }

    await cargarMensajes(conversacion.id_conversacion);
}

//CARGAR MENSAJES

async function cargarMensajes(idConversacion) {
    mensajesChat.replaceChildren();

    const cargando = document.createElement("p");
    cargando.className = "estado-chat";
    cargando.textContent = "Cargando mensajes...";
    mensajesChat.appendChild(cargando);

    try {
        const mensajes = await solicitarAPI(
            `${API_CHAT_URL}/conversaciones/${idConversacion}/mensajes`
        );

        // Evitar mostrar mensajes de una conversación que ya se cambió.
        if (
            !conversacionActual ||
            Number(conversacionActual.id_conversacion) !== Number(idConversacion)
        ) {
            return;
        }

        mensajesChat.replaceChildren();

        if (!Array.isArray(mensajes) || mensajes.length === 0) {
            const vacio = document.createElement("p");
            vacio.className = "estado-chat";
            vacio.textContent =
                "Todavía no hay mensajes. ¡Podés iniciar la conversación!";
            mensajesChat.appendChild(vacio);
            return;
        }

        mensajes.forEach(mensaje => {
            mensajesChat.appendChild(crearElementoMensaje(mensaje));
        });

        mensajesChat.scrollTop = mensajesChat.scrollHeight;

    } catch (error) {
        console.error("Error al cargar mensajes:", error);

        mensajesChat.replaceChildren();

        const aviso = document.createElement("p");
        aviso.className = "estado-chat";
        aviso.textContent = error.message;

        mensajesChat.appendChild(aviso);
    }
}


function crearElementoMensaje(mensaje) {
    const elemento = document.createElement("article");

    const esPropio =
        Number(mensaje.id_emisor) === Number(usuarioActual.id_usuario);

    elemento.className = esPropio
        ? "mensaje mensaje-propio"
        : "mensaje mensaje-ajeno";

    const emisor = document.createElement("span");
    emisor.className = "mensaje-emisor";
    emisor.textContent = esPropio
        ? "Vos"
        : (mensaje.nombre_emisor || "Ciudadano");

    const contenido = document.createElement("p");
    contenido.className = "mensaje-contenido";
    contenido.textContent = mensaje.contenido;

    const fecha = document.createElement("small");
    fecha.className = "mensaje-fecha";
    fecha.textContent = formatearFechaCompleta(mensaje.fecha_hora);

    elemento.append(emisor, contenido, fecha);

    return elemento;
}


function formatearFechaCompleta(fecha) {
    if (!fecha) return "";

    const fechaMensaje = new Date(fecha);

    if (Number.isNaN(fechaMensaje.getTime())) return "";

    return fechaMensaje.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

//ENVIAR MENSAJES

formMensaje.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (enviandoMensaje || !conversacionActual) return;

    const contenido = contenidoMensaje.value.trim();

    if (!contenido) return;

    if (contenido.length > 5000) {
        alert("El mensaje no puede superar los 5000 caracteres.");
        return;
    }

    const idConversacion = conversacionActual.id_conversacion;

    enviandoMensaje = true;

    const botonEnviar = formMensaje.querySelector('button[type="submit"]');
    botonEnviar.disabled = true;

    try {
        await solicitarAPI(
            `${API_CHAT_URL}/conversaciones/${idConversacion}/mensajes`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ contenido })
            }
        );

        contenidoMensaje.value = "";

        await cargarMensajes(idConversacion);
        await cargarConversaciones();

    } catch (error) {
        console.error("Error al enviar mensaje:", error);
        alert(error.message || "No se pudo enviar el mensaje.");

    } finally {
        enviandoMensaje = false;
        botonEnviar.disabled = false;
        contenidoMensaje.focus();
    }
});

//CERRAR SESIÓN

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");

        tokenActual = null;
        usuarioActual = null;
        conversacionActual = null;

        mostrarVisitanteChat();
    });
}

//MENÚ PARA CELULARES

const menuToggle = document.getElementById("menuToggle");
const menuMobile = document.getElementById("menuMobile");
const sidebarBottom = document.querySelector(".sidebar-bottom");

if (menuToggle && menuMobile) {
    menuToggle.addEventListener("click", () => {
        const estaAbierto = menuMobile.classList.toggle("menu-open");

        if (sidebarBottom) {
            sidebarBottom.classList.toggle("menu-open", estaAbierto);
        }

        menuToggle.setAttribute("aria-expanded", String(estaAbierto));
        menuToggle.setAttribute(
            "aria-label",
            estaAbierto
                ? "Cerrar menú de navegación"
                : "Abrir menú de navegación"
        );

        menuToggle.textContent = estaAbierto ? "✕" : "☰";
    });
}


/* CONTADOR DE MENSAJES SIN LEER */

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
            `${API_CHAT_URL}/no-leidos`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!respuesta.ok) return;

        const datos = await respuesta.json();
        const cantidad = Number(datos.cantidad) || 0;

        contador.textContent = cantidad > 9 ? "10+" : cantidad;
        contador.hidden = cantidad === 0;

    } catch (error) {
        console.error("Error al actualizar el contador:", error);
    }
}

// Consultar al entrar y actualizar cada 15 segundos.
actualizarContadorMensajes();
setInterval(actualizarContadorMensajes, 15000);


/* CONTADOR DE NOTIFICACIONES */

async function actualizarContadorNotificaciones() {
    const contador = document.getElementById("contadorNotificaciones");
    const token = localStorage.getItem("token");

    if (!contador) return;

    if (!token) {
        contador.hidden = true;
        contador.textContent = "";
        return;
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

        contador.textContent = cantidad > 9 ? "10+" : cantidad;
        contador.hidden = cantidad === 0;

    } catch (error) {
        console.error(
            "Error al actualizar el contador de notificaciones:",
            error
        );
    }
}

actualizarContadorNotificaciones();
setInterval(actualizarContadorNotificaciones, 15000);


//INICIAR

comprobarSesionChat();
