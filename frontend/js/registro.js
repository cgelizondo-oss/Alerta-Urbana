const formRegistro = document.getElementById("formRegistro");
const mensaje = document.getElementById("mensaje");

formRegistro.addEventListener("submit", async (event) => {

    event.preventDefault();

    const nombre = document.getElementById("nombre").value;
    const apellido = document.getElementById("apellido").value;
    const dni = document.getElementById("dni").value.trim();
    const localidad = document.getElementById("localidad").value;
    const calle = document.getElementById("calle").value;
    const numero = document.getElementById("numero").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmarPassword =
        document.getElementById("confirmarPassword").value;

        const datosUsuario = {
            nombre,
            apellido,
            dni,
            localidad,
            calle,
            numero,
            email,
            password,
            confirmarPassword
        };

   

    try {

        const respuesta = await fetch(
            "http://localhost:3000/api/usuarios/registro",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(datosUsuario)
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {

            mensaje.textContent =
                datos.mensaje || "No se pudo realizar el registro";

            mensaje.className = "mensaje-error";

            return;
        }

        mensaje.textContent =
            datos.mensaje || "Usuario registrado correctamente";

        mensaje.className = "mensaje-exito";

        formRegistro.reset();

    } catch (error) {

        console.error("Error al registrar usuario:", error);

        mensaje.textContent =
            "No se pudo conectar con el servidor";

        mensaje.className = "mensaje-error";
    }

});