const formRecuperacion = document.getElementById("formRecuperacion");
const mensaje = document.getElementById("mensaje");

formRecuperacion.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value;

    try {

        const respuesta = await fetch(
            "http://localhost:3000/api/usuarios/recuperar-password",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email
                })
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {

            mensaje.textContent =
                datos.mensaje || "No se pudo procesar la solicitud";

            mensaje.className = "mensaje-error";

            return;
        }

        mensaje.textContent =
            datos.mensaje || "Solicitud procesada correctamente";

        mensaje.className = "mensaje-exito";

        /*
            TEMPORAL PARA DESARROLLO

            El backend actualmente devuelve el token.
            Lo guardamos para utilizarlo en la pantalla
            de restablecimiento de contraseña.

            Más adelante, en un sistema real, este token
            debería llegar mediante un enlace enviado
            al correo electrónico.
        */
        if (datos.token) {

            sessionStorage.setItem(
                "tokenRecuperacion",
                datos.token
            );

            setTimeout(() => {

                window.location.href =
                    "restablecer-password.html";

            }, 1000);
        }

    } catch (error) {

        console.error(
            "Error al solicitar recuperación:",
            error
        );

        mensaje.textContent =
            "No se pudo conectar con el servidor";

        mensaje.className = "mensaje-error";
    }

});