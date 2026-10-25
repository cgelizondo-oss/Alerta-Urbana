
const express = require("express");
const pool = require("../config/db");
const { verificarToken } = require("../middlewares/authMiddleware");
const upload = require("../config/multerMascotas");
const fs = require("fs");
const path = require("path");

const router = express.Router();


router.get("/", async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT
                m.*,
                e.nombre AS estado
             FROM mascotas_perdidas m
             JOIN estado_publicacion e
               ON e.id_estado_publicacion = m.id_estado_publicacion
             ORDER BY m.fecha_publicacion DESC`
        );

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar mascotas:", error);

        res.status(500).json({
            mensaje: "Error al consultar las mascotas"
        });
    }
});


const eliminarImagenSubida = (archivo) => {
    if (archivo) {
        fs.unlink(archivo.path, (error) => {
            if (error) {
                console.error("Error al eliminar imagen:", error);
            }
        });
    }
};

router.post(
    "/",
    verificarToken,
    upload.single("imagen"),
    async (req, res) => {
        try {
            const {
                nombre,
                tipo_animal,
                descripcion,
                ubicacion,
                latitud,
                longitud,
                fecha_perdida,
                datos_contacto
            } = req.body;

            const id_usuario = req.usuario.id_usuario;

            const coordenadaValida = (valor, minimo, maximo) => {
                if (valor === undefined || valor === null || valor === "") {
                    return true;
                }

                const numero = Number(valor);

                return Number.isFinite(numero) &&
                    numero >= minimo &&
                    numero <= maximo;
            };

            if (
                !nombre?.trim() ||
                !tipo_animal?.trim() ||
                !descripcion?.trim() ||
                !ubicacion?.trim() ||
                !fecha_perdida
            ) {
                eliminarImagenSubida(req.file);

                return res.status(400).json({
                    mensaje: "Completá todos los campos obligatorios"
                });
            }

            if (
                !coordenadaValida(latitud, -90, 90) ||
                !coordenadaValida(longitud, -180, 180)
            ) {
                eliminarImagenSubida(req.file);

                return res.status(400).json({
                    mensaje: "Las coordenadas ingresadas no son válidas"
                });
            }

            if (
                (latitud === "" || latitud == null) !==
                (longitud === "" || longitud == null)
            ) {
                eliminarImagenSubida(req.file);

                return res.status(400).json({
                    mensaje: "Debés indicar ambas coordenadas"
                });
            }

            const fechaValida =
                /^\d{4}-\d{2}-\d{2}$/.test(fecha_perdida) &&
                !Number.isNaN(Date.parse(`${fecha_perdida}T00:00:00`));

            if (!fechaValida) {
                eliminarImagenSubida(req.file);

                return res.status(400).json({
                    mensaje: "La fecha de pérdida no es válida"
                });
            }

            const estado = await pool.query(
                `SELECT id_estado_publicacion
                 FROM estado_publicacion
                 WHERE id_estado_publicacion = 1`
            );

            if (estado.rows.length === 0) {
                eliminarImagenSubida(req.file);

                return res.status(500).json({
                    mensaje: "No se encontró el estado inicial de publicación"
                });
            }

            const foto = req.file
                ? `/uploads/mascotas/${req.file.filename}`
                : null;

            const resultado = await pool.query(
                `INSERT INTO mascotas_perdidas (
                    id_usuario,
                    id_estado_publicacion,
                    nombre,
                    tipo_animal,
                    descripcion,
                    foto,
                    ubicacion,
                    latitud,
                    longitud,
                    fecha_perdida,
                    datos_contacto
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    id_usuario,
                    1,
                    nombre.trim(),
                    tipo_animal.trim(),
                    descripcion.trim(),
                    foto,
                    ubicacion.trim(),
                    latitud === "" || latitud == null ? null : Number(latitud),
                    longitud === "" || longitud == null ? null : Number(longitud),
                    fecha_perdida,
                    datos_contacto?.trim() || null
                ]
            );

            return res.status(201).json({
                mensaje: "Mascota publicada correctamente",
                mascota: resultado.rows[0]
            });
        } catch (error) {
            eliminarImagenSubida(req.file);

            console.error("Error al publicar mascota:", error);

            return res.status(500).json({
                mensaje: "Error al publicar la mascota"
            });
        }
    }
);

module.exports = router;
