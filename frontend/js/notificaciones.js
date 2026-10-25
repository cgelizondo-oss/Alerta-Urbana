

const API_NOTIFICACIONES = "http://localhost:3000/api/notificaciones";
const API_USUARIOS_URL = "http://localhost:3000/api/usuarios";

const listaNotificaciones = document.getElementById("listaNotificaciones");

async function protegerNotificaciones() {
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


async function cargarNotificaciones() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const respuesta = await fetch(API_NOTIFICACIONES, {
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
            throw new Error("No se pudieron cargar las notificaciones");
        }

        const datos = await respuesta.json();

        listaNotificaciones.replaceChildren();
        await actualizarContadorNotificaciones();

        if (datos.notificaciones.length === 0) {
            const mensaje = document.createElement("p");
            mensaje.className = "empty-message";
            mensaje.textContent = "Todavía no tenés notificaciones.";
            listaNotificaciones.appendChild(mensaje);
            return;
        }

        datos.notificaciones.forEach(notificacion => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "notificacion-card";

            if (!notificacion.leida) {
                tarjeta.classList.add("no-leida");
            }

            const informacion = document.createElement("div");
            informacion.className = "notificacion-info";

            const titulo = document.createElement("h3");
            titulo.className = "notificacion-titulo";
            titulo.textContent = notificacion.titulo;

            const mensaje = document.createElement("p");
            mensaje.className = "notificacion-mensaje";
            mensaje.textContent = notificacion.mensaje;

            const tipo = document.createElement("p");
            tipo.className = "notificacion-detalle";
            tipo.textContent =
                "Tipo: " + notificacion.tipo.replaceAll("_", " ");

            const fecha = document.createElement("p");
            fecha.className = "notificacion-detalle";
            fecha.textContent = "Fecha: " +
                new Date(notificacion.fecha_hora).toLocaleString("es-AR");

            const estado = document.createElement("p");
            estado.className = "notificacion-detalle notificacion-estado";
            estado.textContent = notificacion.leida
                ? "Estado: Leída"
                : "Estado: No leída";

            informacion.append(titulo, mensaje, tipo, fecha, estado);
            tarjeta.appendChild(informacion);


            // Mostrar enlace al reporte asociado a la notificación

            if (notificacion.id_reporte) {
                const enlaceReporte = document.createElement("a");

                enlaceReporte.href =
                    `detalle-reporte.html?id=${encodeURIComponent(notificacion.id_reporte)}`;

                enlaceReporte.className = "btn-ver-reporte";
                enlaceReporte.textContent = "Ver reporte";

                enlaceReporte.addEventListener("click", async (evento) => {
                    // Si ya está leída, abrir el reporte normalmente
                    if (notificacion.leida) return;

                    evento.preventDefault();

                    enlaceReporte.textContent = "Abriendo...";
                    enlaceReporte.style.pointerEvents = "none";

                    try {
                        const respuesta = await fetch(
                            `${API_NOTIFICACIONES}/${notificacion.id_notificacion}/leer`,
                            {
                                method: "PATCH",
                                headers: {
                                    Authorization: "Bearer " + token
                                }
                            }
                        );

                        if (!respuesta.ok) {
                            throw new Error("No se pudo marcar como leída");
                        }

                        // Abrir el reporte después de marcar la notificación
                        window.location.href = enlaceReporte.href;

                    } catch (error) {
                        console.error("Error al abrir el reporte:", error);

                        enlaceReporte.textContent = "Ver reporte";
                        enlaceReporte.style.pointerEvents = "";

                        alert("No se pudo marcar la notificación como leída. Intentá nuevamente.");
                    }
                });

                tarjeta.appendChild(enlaceReporte);
            }



            if (!notificacion.leida) {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.className = "btn-marcar-leida";
                boton.textContent = "Marcar leída";

                boton.addEventListener("click", async () => {
                    boton.disabled = true;
                    boton.textContent = "Guardando...";

                    try {
                        const respuesta = await fetch(
                            `${API_NOTIFICACIONES}/${notificacion.id_notificacion}/leer`,
                            {
                                method: "PATCH",
                                headers: {
                                    Authorization: "Bearer " + token
                                }
                            }
                        );

                        if (!respuesta.ok) {
                            throw new Error("No se pudo marcar la notificación como leída");
                        }

                        await cargarNotificaciones();

                    } catch (error) {
                        console.error("Error al marcar notificación:", error);
                        boton.disabled = false;
                        boton.textContent = "Marcar leída";
                        alert("No se pudo marcar la notificación como leída.");
                    }
                });


                tarjeta.appendChild(boton);
            }

            listaNotificaciones.appendChild(tarjeta);
        });

    } catch (error) {
        console.error("Error al cargar notificaciones:", error);

        listaNotificaciones.replaceChildren();

        const mensaje = document.createElement("p");
        mensaje.className = "empty-message";
        mensaje.textContent =
            "No pudimos cargar las notificaciones. Intentá nuevamente.";

        listaNotificaciones.appendChild(mensaje);
    }
}


async function actualizarContadorNotificaciones() {
    const contador = document.getElementById("contadorNotificaciones");
    if (!contador) return;

    const token = localStorage.getItem("token");

    if (!token) {
        contador.hidden = true;
        return;
    }

    try {
        const respuesta = await fetch(
            `${API_NOTIFICACIONES}/sin-leer`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!respuesta.ok) {
            contador.hidden = true;
            return;
        }

        const datos = await respuesta.json();
        const cantidad = datos.cantidad;

        if (cantidad > 0) {
            contador.textContent = cantidad > 9 ? "10+" : cantidad;
            contador.hidden = false;
        } else {
            contador.textContent = "";
            contador.hidden = true;
        }

    } catch (error) {
        console.error("Error al actualizar el contador:", error);
        contador.hidden = true;
    }
}

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

(async () => {
    const sesionValida = await protegerNotificaciones();

    if (!sesionValida) return;

    await cargarNotificaciones();

    actualizarContadorMensajes();
    setInterval(actualizarContadorMensajes, 15000);
})();



/* =========================
   MENÚ HAMBURGUESA MÓVIL
========================= */

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
