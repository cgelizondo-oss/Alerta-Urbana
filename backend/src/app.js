const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const usuarioRoutes = require("./routes/usuarioRoutes");
const tipoIncidenciaRoutes = require("./routes/tipoIncidenciaRoutes");
const reporteRoutes = require("./routes/reporteRoutes");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(
    "/uploads",
    express.static(path.join(__dirname, "../uploads"))
);

app.use("/api/usuarios", usuarioRoutes);
app.use("/api/tipos-incidencia", tipoIncidenciaRoutes);
app.use("/api/reportes", reporteRoutes);

async function probarConexion() {
    try{
        const resultado = await pool.query("SELECT NOW()");
        console.log("Base de Datos conectada");
        console.log("Fecha Pg:",resultado.rows[0].now);
    }catch(error) {
        console.error("Error al conectar con Pg");
        console.error(error.message);
        
    }
}

probarConexion();

app.listen(PORT, ()=>{
    console.log(`Servidor ejecutandose en http://localhost:${PORT}`);
});