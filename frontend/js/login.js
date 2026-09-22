const formLogin = document.getElementById("formLogin");
const mensaje = document.getElementById("mensaje");

formLogin.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const datosLogin = {
        email,
        password
    };

    try {

        const respuesta = await fetch(
            "http://localhost:3000/api/usuarios/login",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(datosLogin)
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {

            mensaje.textContent =
                datos.mensaje || "No se pudo iniciar sesión";

            mensaje.className = "mensaje-error";

            return;
        }

        /*
            Guardamos el JWT para utilizarlo después
            en las rutas protegidas.
        */
        localStorage.setItem("token", datos.token);

        /*
            También guardamos los datos básicos
            del usuario autenticado.
        */
        localStorage.setItem(
            "usuario",
            JSON.stringify(datos.usuario)
        );

        mensaje.textContent =
            datos.mensaje || "Inicio de sesión correcto";

        mensaje.className = "mensaje-exito";
        window.location.href = "inicio.html";

    } catch (error) {

        console.error("Error al iniciar sesión:", error);

        mensaje.textContent =
            "No se pudo conectar con el servidor";

        mensaje.className = "mensaje-error";
    }

});