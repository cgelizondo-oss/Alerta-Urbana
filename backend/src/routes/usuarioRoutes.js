const express = require("express");
const pool = require("../config/db");
const router = express.Router();


const {
    registrarUsuario,
    iniciarSesion,
    solicitarRecuperacion,
    restablecerPassword
} = require("../controllers/usuarioController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.post("/registro", registrarUsuario);
router.post("/login", iniciarSesion);
router.post("/recuperar-password", solicitarRecuperacion);
router.post("/restablecer-password", restablecerPassword);


router.get("/perfil", verificarToken, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id_usuario, nombre, apellido, email
             FROM usuarios
             WHERE id_usuario = $1 AND estado = true`,
            [req.usuario.id_usuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                mensaje: "Usuario no disponible"
            });
        }

        return res.status(200).json({
            mensaje: "Acceso autorizado",
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al consultar el perfil:", error);

        return res.status(500).json({
            mensaje: "Error al consultar el perfil"
        });
    }
});

module.exports = router;