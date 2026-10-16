
const express = require("express");
const pool = require("../config/db");
const { verificarToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Obtener las notificaciones del usuario autenticado
router.get("/", verificarToken, async (req, res) => {
    try {
        const idUsuario = req.usuario.id_usuario;

        const resultado = await pool.query(
            `SELECT
                id_notificacion,
                id_reporte,
                titulo,
                mensaje,
                fecha_hora,
                leida,
                tipo
             FROM notificaciones
             WHERE id_usuario = $1
             ORDER BY fecha_hora DESC, id_notificacion DESC`,
            [idUsuario]
        );

        res.status(200).json({
            notificaciones: resultado.rows
        });

    } catch (error) {
        console.error("Error al obtener notificaciones:", error);

        res.status(500).json({
            mensaje: "Error al obtener las notificaciones"
        });
    }
});


// Obtener cantidad de notificaciones sin leer
router.get("/sin-leer", verificarToken, async (req, res) => {
    try {
        const idUsuario = req.usuario.id_usuario;

        const resultado = await pool.query(
            `SELECT COUNT(*)::integer AS cantidad
             FROM notificaciones
             WHERE id_usuario = $1
               AND leida = FALSE`,
            [idUsuario]
        );

        res.status(200).json({
            cantidad: resultado.rows[0].cantidad
        });

    } catch (error) {
        console.error("Error al contar notificaciones:", error);

        res.status(500).json({
            mensaje: "Error al obtener el contador de notificaciones"
        });
    }
});


// Marcar una notificación como leída
router.patch("/:id/leer", verificarToken, async (req, res) => {
    try {
        const idNotificacion = Number(req.params.id);
        const idUsuario = req.usuario.id_usuario;

        if (!Number.isSafeInteger(idNotificacion) || idNotificacion <= 0) {
            return res.status(400).json({
                mensaje: "ID de notificación inválido"
            });
        }

        const resultado = await pool.query(
            `UPDATE notificaciones
             SET leida = TRUE
             WHERE id_notificacion = $1
               AND id_usuario = $2
             RETURNING id_notificacion, leida`,
            [idNotificacion, idUsuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: "Notificación no encontrada"
            });
        }

        res.status(200).json({
            mensaje: "Notificación marcada como leída",
            notificacion: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al marcar notificación como leída:", error);

        res.status(500).json({
            mensaje: "Error al actualizar la notificación"
        });
    }
});



module.exports = router;
