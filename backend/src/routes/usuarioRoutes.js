const express = require("express");
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

router.get("/perfil", verificarToken, (req, res) => {
    return res.status(200).json({
        mensaje: "Acceso autorizado",
        usuario: req.usuario
    });
});

module.exports = router;