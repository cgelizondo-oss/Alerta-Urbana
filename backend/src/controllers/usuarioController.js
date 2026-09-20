const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { json } = require("express");
const jwt = require("jsonwebtoken");

const registrarUsuario = async (req, res) => {
    try {
        const {
            nombre,
            apellido,
            localidad,
            calle,
            numero,
            email,
            password,
            confirmarPassword
        } = req.body;

        //Limpiar espacios al principio y al final
        const nombreLimpio = nombre?.trim();
        const apellidoLimpio = apellido?.trim();
        const localidadLimpia = localidad?.trim();
        const calleLimpia = calle?.trim();
        const numeroLimpio = numero?.trim();
        const emailLimpio = email?.trim().toLowerCase();
        const passwordLimpia = password?.trim();
        const confirmarPasswordLimpia = confirmarPassword?.trim();

        // Validar campos obligatorios
        if(
            !nombreLimpio ||
            !apellidoLimpio ||
            !localidadLimpia ||
            !calleLimpia ||
            !numeroLimpio || 
            !emailLimpio || 
            !passwordLimpia ||
            !confirmarPasswordLimpia
        ) {
            return res.status(400).json({
                mensaje: "Todos los campos son obligatorios y no pueden ser solo espacios"
            });
        }
        
        // Validar formato del email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if(!emailRegex.test(emailLimpio)) {
            return res.status(400).json({
                mensaje: "El correo electronico no es valido"
            });
        }

        // Validar nombre y apellido (solo letras y espacios)
        const nombreApellidoRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;

        if(!nombreApellidoRegex.test(nombreLimpio)) {
            return res.status(400).json({
                mensaje: "El nombre solo puede contener letras y espacios"
            });
        }

        if (!nombreApellidoRegex.test(apellidoLimpio)) {
            return res.status(400).json({
                mensaje: "El apellido solo puede contener letras y espacios"
            });
        }

        // Validar que nombre y apellido tengan un maximo de 50 caracteres
        if(nombreLimpio.length > 50) {
            return res.status(400).json({
                mensaje: "El nombre no puede tener mas de 50 caracteres"
            });
        }

        // Validar que nombre y apellido tengan un maximo de 50 caracteres
        if(apellidoLimpio.length > 50) {
            return res.status(400).json({
                mensaje: "El apellido no puede tener mas de 50 caracteres"
            });
        }

        //Validar longitud de los datos del domicilio
        if (localidadLimpia.length > 100) {
            return res.status(400).json({
                mensaje: "La localidad no puede tener mas de 100 caracteres"
            });
        }

        if (calleLimpia.length > 100) {
            return res.status(400).json({
                mensaje: "La calle no puede tener mas de 100 caracteres"
            });
        }

        if (numeroLimpio.length > 20) {
            return res.status(400).json({
                mensaje: "El numero no puede tener mas de 20 caracteres"
            });
        }

        // Validar contraseña
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

        if(!passwordRegex.test(passwordLimpia)) {
            return res.status(400).json({
                mensaje: "La contraseña debe tener al menos 8 caracteres, una letra y un numero"
            });
        }

        if(passwordLimpia !== confirmarPasswordLimpia) {
            return res.status(400).json({
                mensaje: "Las contraseñas no coinciden"
            });
        }

        // Verificar si el email ya está registrado
        const usuarioExistente = await pool.query(
            "SELECT id_usuario FROM usuarios WHERE email = $1",
                [emailLimpio]
        );
        
        if (usuarioExistente.rows.length > 0) {
            return res.status(409).json({
                mensaje: "El correo electronico ya esta registrado"
            });
        }

        // Encriptar contraseña
        const passwordHash = await bcrypt.hash(passwordLimpia, 10);

       
       // Crear usuario con su domicilio y el rol "usuario"
        const nuevoUsuario = await pool.query(
            `
            INSERT INTO usuarios
            (
                nombre, apellido, localidad, calle, numero,
                email, password, id_rol, estado, fecha_registro
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7,
                (SELECT id_rol FROM roles WHERE nombre = 'usuario'),
                true, CURRENT_TIMESTAMP
            )
            RETURNING
                id_usuario, nombre, apellido, localidad, calle, numero,
                email, id_rol, estado, fecha_registro
            `,
            [
                nombreLimpio,
                apellidoLimpio,
                localidadLimpia,
                calleLimpia,
                numeroLimpio,
                emailLimpio,
                passwordHash
            ]
        );
        return res.status(201).json({
            mensaje: "Usuario registrado correctamente",
            usuario: nuevoUsuario.rows[0]
        });
    } catch (error) {
        console.error("Error al registrar usuario: ", error);
        return res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
};

const iniciarSesion = async(req, res) => {
    try {
        const {
            email,
            password
        } = req.body;
        
        const emailLimpio = email?.trim().toLowerCase();
        const passwordLimpia = password?.trim();

        if(!emailLimpio || !passwordLimpia) {
            return res.status(400).json({
                mensaje: "Email y contraseña son obligatorios"
            });
        }

        const resultadoUsuario = await pool.query(
            `
            SELECT
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.email,
                u.password,
                u.estado,
                u.id_rol,
                r.nombre AS rol
            FROM usuarios AS u
            INNER JOIN roles AS r ON r.id_rol = u.id_rol
            WHERE u.email = $1
            `,
            [emailLimpio]
        );

        if(resultadoUsuario.rows.length ===0) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        const usuario = resultadoUsuario.rows[0];

        const passwordCorrecta = await bcrypt.compare(
            passwordLimpia,
            usuario.password
        );

        if (!passwordCorrecta) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        if (!usuario.estado) {
            return res.status(403).json({
                mensaje: "El usuario se encuentra desactivado"
            });
        }

        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                email: usuario.email,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        return res.status(200).json({
            mensaje: "Inicio de sesion correcto",
            token: token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error("Error al iniciar sesion: ", error);

        return res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
};

const solicitarRecuperacion = async (req, res) => {
    try {
        const { email } = req.body;

        const emailLimpio = email?.trim().toLowerCase();

        if(!emailLimpio) {
            return res.status(400).json({
                mensaje: "El email es obligatorio"
            });
        }

        const resultadoUsuario = await pool.query(
            "SELECT id_usuario, email, estado FROM usuarios WHERE email = $1",
            [emailLimpio]
        );

        if (resultadoUsuario.rows.length === 0) {
            return res.status(404).json({
                mensaje: "Si el correo esta registrado, se generara una solicitud de recuperacion"
            });
        }
        const usuario = resultadoUsuario.rows[0];

        if (!usuario.estado) {
            return res.status(403).json({
                mensaje: "El usuario se encuentra desactivado"
            });
        }

        const tokenRecuperacion = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                email: usuario.email,
                tipo: "recuperacion"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "15m"
            }
        );

        await pool.query(
          `
          INSERT INTO recuperacion_password
          (id_usuario, token, fecha_expiracion, utilizado, fecha_creacion)
          VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '15 minutes', false, CURRENT_TIMESTAMP)
          `,
          [
            usuario.id_usuario,
            tokenRecuperacion
          ]
        );

        return res.status(200).json({
            mensaje:"Solicitud de recuperacion generada correctamente",
            token: tokenRecuperacion
        });
    } catch (error) {
        console.error("Error al solicitar recuperacion:", error);

        return res.status(500).json({
            mensaje: "Error interno del servidor"
        });
        
    }
};

const restablecerPassword = async (req, res) => {
    try {
        const {
            token,
            nuevaPassword,
            confirmarPassword
        } = req.body;

        const tokenLimpio = token?.trim();
        const nuevaPasswordLimpia = nuevaPassword?.trim();
        const confirmarPasswordLimpia = confirmarPassword?.trim();

        if (
            !tokenLimpio ||
            !nuevaPasswordLimpia ||
            !confirmarPasswordLimpia
        ){
            return res.status(400).jason({
                mensaje: "Todos los campos son obligatorios"
            });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

        if (!passwordRegex.test(nuevaPasswordLimpia)) {
            return res.status(400).json({
                mensaje: "La contraseña debe tener al menos 8 caracteres, una letra y un numero"
            });
        }

        if (nuevaPasswordLimpia !== confirmarPasswordLimpia) {
            return res.status(400).json({
                mensaje: "Las contraseñas no coinciden"
            });
        }

        const resultadoRecuperacion = await pool.query(
            `
            SELECT *
            FROM recuperacion_password
            WHERE token = $1
            `,
            [tokenLimpio]
        );

        if (resultadoRecuperacion.rows.length === 0) {
            return res.status(404).json({
                mensaje: "Token de recuperacion invalido"
            });
        }

        const recuperacion = resultadoRecuperacion.rows[0];

        if (recuperacion.utilizado) {
            return res.status(400).json({
                mensaje: "El token de recuperacion ya fue utilizado"
            });
        }

        if (new Date() > new Date(recuperacion.fecha_expiracion)) {
            return res.status(400).json({
                mensaje: "El token de recuperacion ha expirado"
            });
        }

        let datosToken;

        try {
            datosToken = jwt.verify(
                tokenLimpio,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return res.status(400).json({
                mensaje: "Token de recuperacion invalido o expirado"
            });
        }

        if (
            datosToken.tipo !== "recuperacion" ||
            datosToken.id_usuario !== recuperacion.id_usuario
        ) {
            return res.status(400).json({
                mensaje: "Token de recuperacion invalido"
            });
        }

        const nuevaPasswordHash = await bcrypt.hash(
            nuevaPasswordLimpia,
            10
        );

        await pool.query(
         `
         UPDATE usuarios
         SET password = $1
         WHERE id_usuario = $2
         `,
         [
            nuevaPasswordHash,
            recuperacion.id_usuario
         ]   
        );

        await pool.query(
            `
            UPDATE recuperacion_password
            SET utilizado = true
            WHERE id_recuperacion = $1
            `,
            [recuperacion.id_recuperacion]
        );

        return res.status(200).json({
            mensaje: "Contraseña restablecida correctamente"
        });
    } catch (error) {
        console.error("Error al restablecer contraseña:", error);

        return res.status(500).json({
            mensaje: "Error interno del servidor"
        });
        
    }
};

module.exports = {
    registrarUsuario,
    iniciarSesion,
    solicitarRecuperacion,
    restablecerPassword
};