
const express = require("express");
const pool = require("../config/db");
const { verificarToken } = require("../middlewares/authMiddleware");

const router = express.Router();


/* Listar las conversaciones del usuario autenticado */
router.get("/conversaciones", verificarToken, async (req, res) => {
    const idUsuario = Number(req.usuario.id_usuario);

    try {
        const resultado = await pool.query(
            `SELECT
                c.id_conversacion,
                c.id_mascota,
                m.nombre AS nombre_mascota,
                m.foto AS foto_mascota,
                c.id_ciudadano,
                c.id_dueno,
                CASE
                    WHEN c.id_ciudadano = $1 THEN c.id_dueno
                    ELSE c.id_ciudadano
                END AS id_otro_usuario,
                (
                    SELECT mc.contenido
                    FROM mensajes_chat mc
                    WHERE mc.id_conversacion = c.id_conversacion
                    ORDER BY mc.fecha_hora DESC, mc.id_mensaje_chat DESC
                    LIMIT 1
                ) AS ultimo_mensaje,
                (
                    SELECT mc.fecha_hora
                    FROM mensajes_chat mc
                    WHERE mc.id_conversacion = c.id_conversacion
                    ORDER BY mc.fecha_hora DESC, mc.id_mensaje_chat DESC
                    LIMIT 1
                ) AS fecha_ultimo_mensaje,
                c.fecha_creacion
             FROM conversaciones_mascotas c
             JOIN mascotas_perdidas m
                ON m.id_mascota = c.id_mascota
             WHERE c.id_ciudadano = $1
                OR c.id_dueno = $1
             ORDER BY
                COALESCE(
                    (
                        SELECT MAX(mc.fecha_hora)
                        FROM mensajes_chat mc
                        WHERE mc.id_conversacion = c.id_conversacion
                    ),
                    c.fecha_creacion
                ) DESC`,
            [idUsuario]
        );

        return res.json(resultado.rows);
    } catch (error) {
        console.error("Error al listar conversaciones:", error);

        return res.status(500).json({
            mensaje: "Error al consultar las conversaciones"
        });
    }
});


// Iniciar una conversación o recuperar la existente
router.post("/conversaciones", verificarToken, async (req, res) => {
    const idCiudadano = Number(req.usuario.id_usuario);
    const { id_mascota } = req.body;
    const idMascota = Number(id_mascota);

    if (
        !Number.isInteger(idCiudadano) ||
        !Number.isInteger(idMascota) ||
        idMascota <= 0
    ) {
        return res.status(400).json({
            mensaje: "El identificador de la mascota no es válido"
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT id_usuario
             FROM mascotas_perdidas
             WHERE id_mascota = $1`,
            [idMascota]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: "No se encontró el aviso de la mascota"
            });
        }

        const idDueno = resultado.rows[0].id_usuario;

        if (Number(idDueno) === idCiudadano) {
            return res.status(400).json({
                mensaje: "No podés iniciar una conversación con vos mismo"
            });
        }

        const conversacion = await pool.query(
            `INSERT INTO conversaciones_mascotas (
                id_mascota,
                id_ciudadano,
                id_dueno
             )
             VALUES ($1, $2, $3)
             ON CONFLICT (id_mascota, id_ciudadano, id_dueno)
             DO NOTHING
             RETURNING *`,
            [idMascota, idCiudadano, idDueno]
        );

        if (conversacion.rows.length > 0) {
            return res.status(201).json({
                mensaje: "Conversación iniciada correctamente",
                conversacion: conversacion.rows[0]
            });
        }

        const existente = await pool.query(
            `SELECT *
             FROM conversaciones_mascotas
             WHERE id_mascota = $1
               AND id_ciudadano = $2
               AND id_dueno = $3`,
            [idMascota, idCiudadano, idDueno]
        );

        return res.status(200).json({
            mensaje: "Se recuperó la conversación existente",
            conversacion: existente.rows[0]
        });
    } catch (error) {
        console.error("Error al iniciar conversación:", error);

        return res.status(500).json({
            mensaje: "Error al iniciar la conversación"
        });
    }
});


/* Consultar los mensajes de una conversación */
router.get("/conversaciones/:id/mensajes", verificarToken, async (req, res) => {
    const idUsuario = Number(req.usuario.id_usuario);
    const idConversacion = Number(req.params.id);

    if (!Number.isInteger(idConversacion) || idConversacion <= 0) {
        return res.status(400).json({
            mensaje: "El identificador de la conversación no es válido"
        });
    }

    try {
        const acceso = await pool.query(
            `SELECT id_conversacion
             FROM conversaciones_mascotas
             WHERE id_conversacion = $1
               AND (id_ciudadano = $2 OR id_dueno = $2)`,
            [idConversacion, idUsuario]
        );

        if (acceso.rows.length === 0) {
            return res.status(404).json({
                mensaje: "No se encontró la conversación"
            });
        }

        // Marcar como leídos los mensajes recibidos
        await pool.query(
            `UPDATE mensajes_chat
     SET fecha_leido = CURRENT_TIMESTAMP
     WHERE id_conversacion = $1
       AND id_emisor <> $2
       AND fecha_leido IS NULL`,
            [idConversacion, idUsuario]
        );

        const resultado = await pool.query(
            `SELECT
                mc.id_mensaje_chat,
                mc.id_conversacion,
                mc.id_emisor,
                u.nombre AS nombre_emisor,
                mc.contenido,
                mc.fecha_hora
             FROM mensajes_chat mc
             JOIN usuarios u ON u.id_usuario = mc.id_emisor
             WHERE mc.id_conversacion = $1
             ORDER BY mc.fecha_hora ASC, mc.id_mensaje_chat ASC`,
            [idConversacion]
        );

        return res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar mensajes:", error);

        return res.status(500).json({
            mensaje: "Error al consultar los mensajes"
        });
    }
});


/* Enviar un mensaje en una conversación */
router.post("/conversaciones/:id/mensajes", verificarToken, async (req, res) => {
    const idUsuario = Number(req.usuario.id_usuario);
    const idConversacion = Number(req.params.id);
    const contenido = req.body.contenido;

    if (!Number.isInteger(idConversacion) || idConversacion <= 0) {
        return res.status(400).json({
            mensaje: "El identificador de la conversación no es válido"
        });
    }

    if (typeof contenido !== "string" || !contenido.trim()) {
        return res.status(400).json({
            mensaje: "El mensaje no puede estar vacío"
        });
    }

    if (contenido.trim().length > 5000) {
        return res.status(400).json({
            mensaje: "El mensaje no puede superar los 5000 caracteres"
        });
    }

    try {
        const acceso = await pool.query(
            `SELECT id_conversacion
             FROM conversaciones_mascotas
             WHERE id_conversacion = $1
               AND (id_ciudadano = $2 OR id_dueno = $2)`,
            [idConversacion, idUsuario]
        );

        if (acceso.rows.length === 0) {
            return res.status(404).json({
                mensaje: "No se encontró la conversación"
            });
        }

        const resultado = await pool.query(
            `INSERT INTO mensajes_chat (
                id_conversacion,
                id_emisor,
                contenido
             )
             VALUES ($1, $2, $3)
             RETURNING *`,
            [idConversacion, idUsuario, contenido.trim()]
        );

        return res.status(201).json({
            mensaje: "Mensaje enviado correctamente",
            mensaje_chat: resultado.rows[0]
        });
    } catch (error) {
        console.error("Error al enviar mensaje:", error);

        return res.status(500).json({
            mensaje: "Error al enviar el mensaje"
        });
    }
});


/* Contar mensajes sin leer del usuario autenticado */
router.get("/no-leidos", verificarToken, async (req, res) => {
    const idUsuario = Number(req.usuario.id_usuario);

    try {
        const resultado = await pool.query(
            `SELECT COUNT(*) AS cantidad
             FROM mensajes_chat mc
             JOIN conversaciones_mascotas c
               ON c.id_conversacion = mc.id_conversacion
             WHERE mc.id_emisor <> $1
               AND mc.fecha_leido IS NULL
               AND (
                   c.id_ciudadano = $1
                   OR c.id_dueno = $1
               )`,
            [idUsuario]
        );

        return res.json({
            cantidad: Number(resultado.rows[0].cantidad)
        });
    } catch (error) {
        console.error("Error al contar mensajes sin leer:", error);

        return res.status(500).json({
            mensaje: "Error al consultar los mensajes sin leer"
        });
    }
});


module.exports = router;
