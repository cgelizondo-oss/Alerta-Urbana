// Obtener el ID del reporte desde la URL
const parametrosURL = new URLSearchParams(window.location.search);
const idReporte = parametrosURL.get("id");

// Contenedor donde mostraremos la información
const detalleReporte = document.getElementById("detalleReporte");

// Comprobar que el ID sea válido
if (!idReporte || !/^[1-9]\d*$/.test(idReporte)) {
    detalleReporte.textContent = "El número de reporte no es válido.";
} else {
    cargarDetalleReporte(idReporte);
    cargarHistorialReporte(idReporte);
}

// Consultar la información de un reporte
async function cargarDetalleReporte(id) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const respuesta = await fetch(
            `http://localhost:3000/api/reportes/${id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (respuesta.status === 401 || respuesta.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");
            window.location.href = "login.html";
            return;
        }

        if (!respuesta.ok) {
            throw new Error("No se pudo consultar el reporte");
        }

        const datos = await respuesta.json();

        console.log("Detalle del reporte:", datos.reporte);

        const reporte = datos.reporte;

        // Limpiar el contenido anterior
        detalleReporte.replaceChildren();

        // Crear el número del reporte
        const numero = document.createElement("p");
        numero.textContent = `Reporte #${reporte.id_reporte}`;

        // Crear el título
        const titulo = document.createElement("h3");
        titulo.textContent = reporte.titulo;

        // Crear el tipo de incidencia
        const tipo = document.createElement("p");
        tipo.textContent = `Tipo de incidencia: ${reporte.tipo_incidencia}`;

        // Crear la descripción
        const descripcion = document.createElement("p");
        descripcion.textContent = `Descripción: ${reporte.descripcion}`;

        // Crear la ubicación
        const ubicacion = document.createElement("p");
        ubicacion.textContent = `Ubicación: ${reporte.ubicacion}`;

        // Crear la fecha de creación
        const fecha = document.createElement("p");
        fecha.textContent = `Fecha de creación: ${new Date(reporte.fecha_creacion).toLocaleDateString("es-AR")
            }`;

        // Crear el estado actual
        const estado = document.createElement("p");
        estado.textContent = `Estado: ${reporte.estado}`;
        estado.className = "reporte-estado";

        const nombreEstado = reporte.estado.trim().toLowerCase();

        if (nombreEstado === "pendiente") {
            estado.classList.add("estado-pendiente");
        } else if (nombreEstado === "en proceso") {
            estado.classList.add("estado-proceso");
        } else if (nombreEstado === "resuelto") {
            estado.classList.add("estado-resuelto");
        }

        // Mostrar los elementos
        detalleReporte.append(
            numero,
            titulo,
            tipo,
            descripcion,
            ubicacion,
            fecha,
            estado
        );

        // Mostrar la imagen adjunta, si existe
        if (reporte.imagen) {
            const imagen = document.createElement("img");

            imagen.src = `http://localhost:3000${reporte.imagen}`;
            imagen.alt = `Imagen del reporte: ${reporte.titulo}`;
            imagen.className = "imagen-reporte";
            imagen.loading = "lazy";

            detalleReporte.appendChild(imagen);
        }

        // Mostrar el botón únicamente al propietario del reporte
        const usuarioGuardado = JSON.parse(localStorage.getItem("usuario") || "null");

        const esPropietario =
            usuarioGuardado &&
            Number(usuarioGuardado.id_usuario) === Number(reporte.id_usuario);

        const estaResuelto =
            reporte.estado.trim().toLowerCase() === "resuelto";

        if (esPropietario && !estaResuelto) {
            const botonResolver = document.createElement("button");

            botonResolver.type = "button";
            botonResolver.textContent = "Marcar como resuelto";
            botonResolver.className = "btn-resolver";
            botonResolver.id = "btnResolverReporte";

            botonResolver.addEventListener("click", async () => {
                const confirmar = window.confirm(
                    "¿Estás seguro de que querés marcar este reporte como resuelto?"
                );

                if (!confirmar) return;

                botonResolver.disabled = true;
                botonResolver.textContent = "Actualizando...";

                try {
                    const respuesta = await fetch(
                        `http://localhost:3000/api/reportes/${reporte.id_reporte}/resolver`,
                        {
                            method: "PATCH",
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        }
                    );

                    const datos = await respuesta.json();

                    if (!respuesta.ok) {
                        throw new Error(
                            datos.mensaje || "No se pudo resolver el reporte"
                        );
                    }

                    alert(datos.mensaje);

                    // Actualizar el detalle y el historial
                    await cargarDetalleReporte(reporte.id_reporte);
                    await cargarHistorialReporte(reporte.id_reporte);

                } catch (error) {
                    console.error("Error al resolver el reporte:", error);
                    alert(error.message);

                    botonResolver.disabled = false;
                    botonResolver.textContent = "Marcar como resuelto";
                }
            });

            detalleReporte.appendChild(botonResolver);
        }

        // Permitir avisar sobre reportes de otros ciudadanos
        if (usuarioGuardado && !esPropietario && !estaResuelto) {
            const botonAvisar = document.createElement("button");

            botonAvisar.type = "button";
            botonAvisar.textContent = "Avisar que fue solucionado";
            botonAvisar.className = "btn-avisar";
            botonAvisar.id = "btnAvisarResolucion";

            botonAvisar.addEventListener("click", async () => {
                const confirmar = window.confirm(
                    "¿Querés informar que esta incidencia ya fue solucionada? " +
                    "El aviso quedará pendiente de revisión."
                );

                if (!confirmar) return;

                botonAvisar.disabled = true;
                botonAvisar.textContent = "Enviando aviso...";

                try {
                    const respuesta = await fetch(
                        `http://localhost:3000/api/reportes/${reporte.id_reporte}/aviso-resolucion`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        }
                    );

                    const datos = await respuesta.json();

                    if (respuesta.status === 409) {
                        alert(datos.mensaje);

                        botonAvisar.textContent = "Aviso enviado recientemente";
                        botonAvisar.disabled = true;
                        return;
                    }

                    if (!respuesta.ok) {
                        throw new Error(
                            datos.mensaje || "No se pudo enviar el aviso"
                        );
                    }

                    alert(datos.mensaje);

                    botonAvisar.textContent = "Aviso enviado";
                    botonAvisar.disabled = true;

                } catch (error) {
                    console.error("Error al enviar el aviso:", error);

                    alert(error.message);

                    botonAvisar.disabled = false;
                    botonAvisar.textContent = "Avisar que fue solucionado";
                }
            });

            detalleReporte.appendChild(botonAvisar);

            // Consultar si el ciudadano debe esperar para enviar otro aviso
            try {
                const respuestaEstado = await fetch(
                    `http://localhost:3000/api/reportes/${reporte.id_reporte}/estado-aviso`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (!respuestaEstado.ok) {
                    throw new Error("No se pudo consultar el estado del aviso");
                }

                const datosEstado = await respuestaEstado.json();

                if (!datosEstado.puede_avisar) {
                    const fechaProximoAviso = new Date(datosEstado.proximo_aviso);

                    botonAvisar.disabled = true;
                    botonAvisar.textContent = "Aviso enviado recientemente";

                    const mensajeEspera = document.createElement("p");
                    mensajeEspera.className = "mensaje-proximo-aviso";

                    mensajeEspera.textContent =
                        `Podrás volver a enviar un aviso el ${fechaProximoAviso.toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short"
                        })}.`;

                    detalleReporte.appendChild(mensajeEspera);
                }

            } catch (error) {
                console.error("Error al consultar el próximo aviso:", error);

                botonAvisar.disabled = true;
                botonAvisar.textContent = "Avisos no disponibles";
            }
        }

        // Mostrar la opción de denunciar reportes de otros ciudadanos
        if (usuarioGuardado && !esPropietario) {
            const botonDenunciar = document.createElement("button");

            botonDenunciar.type = "button";
            botonDenunciar.textContent = "Denunciar reporte";
            botonDenunciar.className = "btn-denunciar";
            botonDenunciar.id = "btnDenunciarReporte";

            // Abrir el formulario de denuncia
            botonDenunciar.addEventListener("click", () => {
                const modal = document.getElementById("modalDenuncia");
                const formulario = document.getElementById("formDenuncia");

                formulario.reset();
                modal.showModal();
            });


            detalleReporte.appendChild(botonDenunciar);


            // Consultar si este usuario ya denunció el reporte
            try {
                const respuestaEstado = await fetch(
                    `http://localhost:3000/api/reportes/${reporte.id_reporte}/estado-denuncia`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (!respuestaEstado.ok) {
                    throw new Error("No se pudo consultar el estado de la denuncia");
                }

                const datosEstado = await respuestaEstado.json();

                if (datosEstado.ya_denunciado) {
                    botonDenunciar.disabled = true;
                    botonDenunciar.textContent = "Reporte ya denunciado";
                }

            } catch (error) {
                console.error("Error al consultar la denuncia:", error);

                botonDenunciar.disabled = true;
                botonDenunciar.textContent = "Denuncia no disponible";
            }

        }

    } catch (error) {
        console.error("Error al cargar el reporte:", error);

        detalleReporte.textContent =
            "Ocurrió un error al cargar el reporte.";
    }
}

async function cargarHistorialReporte(id) {
    const contenedor = document.getElementById("historialReporte");
    const token = localStorage.getItem("token");

    if (!contenedor || !token) return;

    try {
        const respuesta = await fetch(
            `http://localhost:3000/api/reportes/${id}/historial`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el historial");
        }

        const datos = await respuesta.json();

        contenedor.replaceChildren();

        if (datos.historial.length === 0) {
            const mensaje = document.createElement("p");
            mensaje.textContent =
                "Este reporte todavía no tiene cambios de estado registrados.";

            contenedor.appendChild(mensaje);
            return;
        }

        datos.historial.forEach((registro) => {
            const elemento = document.createElement("div");
            elemento.className = "historial-item";

            const estado = document.createElement("h3");
            estado.textContent = registro.estado;

            const fecha = document.createElement("p");
            fecha.textContent = `Fecha: ${new Date(
                registro.fecha_cambio
            ).toLocaleString("es-AR")}`;

            const comentario = document.createElement("p");
            comentario.textContent =
                registro.comentario || "Sin comentarios";

            elemento.append(estado, fecha, comentario);
            contenedor.appendChild(elemento);
        });

    } catch (error) {
        console.error("Error al cargar el historial:", error);

        contenedor.textContent =
            "No se pudo cargar el historial del reporte.";
    }
}


// Cerrar el formulario de denuncia
document.getElementById("cancelarDenuncia").addEventListener("click", () => {
    document.getElementById("modalDenuncia").close();
});


// Enviar denuncia al backend
document.getElementById("formDenuncia").addEventListener("submit", async (event) => {
    event.preventDefault();

    const modal = document.getElementById("modalDenuncia");
    const botonEnviar = document.getElementById("enviarDenuncia");

    const motivo = document.getElementById("motivoDenuncia").value;
    const descripcion = document.getElementById("descripcionDenuncia").value.trim();

    const idReporte = Number(new URLSearchParams(window.location.search).get("id"));
    const token = localStorage.getItem("token");

    if (!Number.isSafeInteger(idReporte) || idReporte <= 0) {
        alert("No se pudo identificar el reporte");
        return;
    }

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const confirmar = window.confirm(
        "¿Querés enviar esta denuncia? Quedará pendiente de revisión."
    );

    if (!confirmar) return;

    botonEnviar.disabled = true;
    botonEnviar.textContent = "Enviando...";

    try {
        const respuesta = await fetch(
            `http://localhost:3000/api/reportes/${idReporte}/denunciar`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    motivo,
                    descripcion
                })
            }
        );

        const datos = await respuesta.json();

        if (respuesta.status === 409) {
            alert(datos.mensaje);
            modal.close();
            return;
        }

        if (respuesta.status === 401) {
            alert("Tu sesión expiró. Iniciá sesión nuevamente.");
            window.location.href = "login.html";
            return;
        }

        if (!respuesta.ok) {
            throw new Error(datos.mensaje || "No se pudo enviar la denuncia");
        }

        modal.close();
        alert(datos.mensaje);


        // Actualizar el botón sin recargar la página
        const botonDenunciar = document.getElementById("btnDenunciarReporte");

        if (botonDenunciar) {
            botonDenunciar.disabled = true;
            botonDenunciar.textContent = "Reporte ya denunciado";
        }


    } catch (error) {
        console.error("Error al enviar la denuncia:", error);
        alert(error.message);

    } finally {
        botonEnviar.disabled = false;
        botonEnviar.textContent = "Enviar denuncia";
    }
});


/* Menú hamburguesa para dispositivos móviles */
const menuToggle = document.getElementById("menuToggle");
const menuMobile = document.getElementById("menuMobile");

if (menuToggle && menuMobile) {
    menuToggle.addEventListener("click", () => {
        const estaAbierto = menuMobile.classList.toggle("menu-open");

        menuToggle.setAttribute("aria-expanded", String(estaAbierto));
    });
}
