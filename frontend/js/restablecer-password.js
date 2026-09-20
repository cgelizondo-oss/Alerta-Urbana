const formRestablecer = document.getElementById("formRestablecer");
const mensaje = document.getElementById("mensaje");

formRestablecer.addEventListener("submit", async (event) => {

    event.preventDefault();

    const nuevaPassword =
        document.getElementById("nuevaPassword").value;

    const confirmarPassword =
        document.getElementById("confirmarPassword").value;

    // Recuperamos el token guardado en el paso anterior
    const tokenRecuperacion =
        sessionStorage.getItem("tokenRecuperacion");

    if (!tokenRecuperacion) {

        mensaje.textContent =
            "No existe una solicitud de recuperación válida";

        mensaje.className = "mensaje-error";

        return;
    }

    try {

        const respuesta = await fetch(
            "http://localhost:3000/api/usuarios/restablecer-password",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    token: tokenRecuperacion,
                    nuevaPassword: nuevaPassword,
                    confirmarPassword: confirmarPassword
                })
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {

            mensaje.textContent =
                datos.mensaje ||
                "No se pudo restablecer la contraseña";

            mensaje.className = "mensaje-error";

            return;
        }

        mensaje.textContent =
            datos.mensaje ||
            "Contraseña restablecida correctamente";

        mensaje.className = "mensaje-exito";

        // El token ya fue utilizado, así que lo eliminamos
        sessionStorage.removeItem("tokenRecuperacion");

        formRestablecer.reset();

        // Volvemos al login después de 2 segundos
        setTimeout(() => {

            window.location.href = "login.html";

        }, 2000);

    } catch (error) {

        console.error(
            "Error al restablecer contraseña:",
            error
        );

        mensaje.textContent =
            "No se pudo conectar con el servidor";

        mensaje.className = "mensaje-error";
    }

});