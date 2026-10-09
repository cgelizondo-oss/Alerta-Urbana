const express = require("express");
const pool = require("../config/db");
const { verificarToken } = require("../middlewares/authMiddleware");
const upload = require("../config/multer");
const fs = require("fs");

const router = express.Router();

const eliminarImagenSubida = (archivo) => {
    if (!archivo) return;

    fs.unlink(archivo.path, (error) => {
        if (error) {
            console.error("Error al eliminar la imagen subida:", error);
        }
    });
};

router.post("/", verificarToken, upload.single("imagen"), async (req, res) => {
    try {
        const {
            id_tipo,
            titulo,
            descripcion,
            ubicacion,
            latitud,
            longitud
        } = req.body;

        const id_usuario = req.usuario.id_usuario;

        const imagen = req.file
            ? `/uploads/reportes/${req.file.filename}`
            : null;

        const coordenadaValida = (valor, minimo, maximo) => {
            if (valor === null || valor === undefined || valor === "") {
                return true;
            }

            const numero = Number(valor);

            return Number.isFinite(numero) &&
                numero >= minimo &&
                numero <= maximo;
        };

        if (
            !coordenadaValida(latitud, -90, 90) ||
            !coordenadaValida(longitud, -180, 180)
        ) {
            
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "Las coordenadas ingresadas no son válidas"
            });
        }

        const tieneLatitud =
            latitud !== null &&
            latitud !== undefined &&
            latitud !== "";

        const tieneLongitud =
            longitud !== null &&
            longitud !== undefined &&
            longitud !== "";

        if (tieneLatitud !== tieneLongitud) {

            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "Debes proporcionar ambas coordenadas o ninguna"
            });
        }

        if (
            !Number.isInteger(Number(id_tipo)) ||
            Number(id_tipo) <= 0 ||
            typeof titulo !== "string" ||
            !titulo.trim() ||
            typeof descripcion !== "string" ||
            !descripcion.trim()
        ) {
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "El tipo de incidencia, título y descripción son obligatorios o inválidos"
            });
        }

        if (titulo.trim().length > 100) {
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "El título no puede superar los 100 caracteres"
            });
        }

        if (descripcion.trim().length > 500) {
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "La descripción no puede superar los 500 caracteres"
            });
        }

        if (
            typeof ubicacion !== "string" ||
            !ubicacion.trim()
        ) {
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "La ubicación es obligatoria"
            });
        }

        if (ubicacion.trim().length > 150) {
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "La ubicación no puede superar los 150 caracteres"
            });
        }

        const tipoExistente = await pool.query(
            "SELECT id_tipo FROM tipo_incidencia WHERE id_tipo = $1",
            [Number(id_tipo)]
        );
        
        if (tipoExistente.rows.length === 0) {
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "El tipo de incidencia seleccionado no existe"
            });
        }

        const resultado = await pool.query(
            `INSERT INTO reportes
                (id_usuario, id_tipo, titulo, descripcion, ubicacion, latitud, longitud, imagen)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                id_usuario,
                Number(id_tipo),
                titulo.trim(),
                descripcion.trim(),
                ubicacion.trim(),
                latitud ?? null,
                longitud ?? null,
                imagen
            ]
        );

        res.status(201).json({
            mensaje: "Reporte creado correctamente",
            reporte: resultado.rows[0]
        });

    } catch (error) {
        eliminarImagenSubida(req.file);
    
        console.error("Error al crear reporte:", error);
    
        res.status(500).json({
            mensaje: "Error al crear el reporte"
        });
    }
});

module.exports = router;