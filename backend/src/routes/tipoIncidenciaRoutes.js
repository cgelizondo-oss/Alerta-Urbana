const express = require("express");
const router = express.Router();

const pool = require("../config/db");

router.get("/", async(req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT id_tipo, nombre, descripcion FROM tipo_incidencia ORDER BY id_tipo ASC"
        );

        res.status(200).json(resultado.rows);
    } catch (error) {
        console.error("Error al obtener tipos de incidencia:", error);

        res.status(500).json({
            mensaje: "Error al obtener los tipos de incidencia",
        });
    }
});

module.exports = router;