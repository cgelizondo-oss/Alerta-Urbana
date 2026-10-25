const express = require("express");
const pool = require("../config/db");
const { verificarToken } = require("../middlewares/authMiddleware");
const upload = require("../config/multer");
const fs = require("fs");
const { notificarCambioEstado } = require("../services/notificacionService");

const router = express.Router();


// Abandonar reportes que llevan 30 días sin actividad
async function abandonarReportesInactivos() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Buscar reportes activos que superaron los 30 días
        // y bloquearlos para evitar cambios simultáneos
        const resultado = await client.query(`
            SELECT id_reporte, id_estado
            FROM reportes
            WHERE id_estado IN (1, 2, 3)
              AND fecha_ultima_actividad <=
                  CURRENT_TIMESTAMP - INTERVAL '30 days'
            FOR UPDATE
        `);

        for (const reporte of resultado.rows) {

            // Cambiar el estado a Abandonado (ID 5)
            await client.query(
                `UPDATE reportes
                 SET id_estado = 5
                 WHERE id_reporte = $1`,
                [reporte.id_reporte]
            );

            // Registrar el cambio en el historial
            await client.query(
                `INSERT INTO historial_reportes
                    (id_reporte, id_estado, id_usuario, comentario)
                 VALUES ($1, $2, $3, $4)`,
                [
                    reporte.id_reporte,
                    5,
                    null,
                    "Reporte marcado automáticamente como abandonado por 30 días sin actividad."
                ]
            );

            // Notificar al creador y a los ciudadanos sumados
            await notificarCambioEstado(
                client,
                reporte.id_reporte,
                "Abandonado"
            );
        }

        await client.query("COMMIT");

        return resultado.rows.length;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;

    } finally {
        client.release();
    }
}


// Ejecutar la revisión de reportes inactivos
async function revisarReportesInactivos() {
    try {
        const cantidad = await abandonarReportesInactivos();

        console.log(
            `Revisión de reportes: ${cantidad} incidencia(s) abandonada(s).`
        );

    } catch (error) {
        console.error(
            "Error al revisar reportes inactivos:",
            error
        );
    }
}



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
            longitud,
            confirmar_incidencia_diferente
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


        if (!tieneLatitud || !tieneLongitud) {

            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "Debes seleccionar una ubicación en el mapa"
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

        if (ubicacion.trim().length > 250) {
            eliminarImagenSubida(req.file);

            return res.status(400).json({
                mensaje: "La ubicación no puede superar los 250 caracteres"
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


        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Evitar que dos reportes de la misma categoría
            // se procesen simultáneamente
            await client.query(
                "SELECT pg_advisory_xact_lock($1, $2)",
                [2026, Number(id_tipo)]
            );

            // Buscar incidencias activas similares a menos de 30 metros
            const similares = await client.query(
                `SELECT
                    r.id_reporte,
                    r.titulo,
                    r.ubicacion,
                    ROUND(
                        (
                            6371000 * 2 * ASIN(
                                LEAST(1, SQRT(
                                    POWER(SIN(RADIANS(r.latitud::double precision - $2) / 2), 2)
                                    +
                                    COS(RADIANS($2)) *
                                    COS(RADIANS(r.latitud::double precision)) *
                                    POWER(SIN(RADIANS(r.longitud::double precision - $3) / 2), 2)
                                ))
                            )
                        )::numeric,
                        1
                    ) AS distancia_metros
                 FROM reportes r
                 WHERE r.id_tipo = $1
                   AND r.id_estado IN (1, 2, 3)
                   AND r.latitud IS NOT NULL
                   AND r.longitud IS NOT NULL
                   AND (
                        6371000 * 2 * ASIN(
                            LEAST(1, SQRT(
                                POWER(SIN(RADIANS(r.latitud::double precision - $2) / 2), 2)
                                +
                                COS(RADIANS($2)) *
                                COS(RADIANS(r.latitud::double precision)) *
                                POWER(SIN(RADIANS(r.longitud::double precision - $3) / 2), 2)
                            ))
                        )
                   ) <= 30
                 ORDER BY distancia_metros ASC`,
                [Number(id_tipo), Number(latitud), Number(longitud)]
            );


            if (
                similares.rows.length > 0 &&
                confirmar_incidencia_diferente !== "true"
            ) {
                await client.query("ROLLBACK");

                eliminarImagenSubida(req.file);

                return res.status(409).json({
                    mensaje: "Ya existen incidencias similares cerca de esta ubicación.",
                    similares: similares.rows
                });
            }

            // Crear el reporte

            const resultado = await client.query(
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

            const reporteCreado = resultado.rows[0];

            // Registrar el estado inicial en el historial
            await client.query(
                `INSERT INTO historial_reportes
            (id_reporte, id_estado, id_usuario, comentario)
         VALUES ($1, $2, $3, $4)`,
                [
                    reporteCreado.id_reporte,
                    reporteCreado.id_estado,
                    id_usuario,
                    "Reporte creado por el ciudadano."
                ]
            );

            await client.query("COMMIT");

            res.status(201).json({
                mensaje: "Reporte creado correctamente",
                reporte: reporteCreado
            });

        } catch (error) {
            await client.query("ROLLBACK");
            throw error;

        } finally {
            client.release();
        }

    } catch (error) {
        eliminarImagenSubida(req.file);

        console.error("Error al crear reporte:", error);

        res.status(500).json({
            mensaje: "Error al crear el reporte"
        });
    }
});


// Buscar incidencias similares cerca de una ubicación
router.get("/similares", verificarToken, async (req, res) => {
    try {
        const { id_tipo, latitud, longitud } = req.query;

        const tipo = Number(id_tipo);
        const lat = Number(latitud);
        const lon = Number(longitud);

        if (
            !Number.isInteger(tipo) ||
            tipo <= 0 ||
            latitud === undefined ||
            longitud === undefined ||
            latitud === "" ||
            longitud === "" ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 || lat > 90 ||
            lon < -180 || lon > 180
        ) {
            return res.status(400).json({
                mensaje: "Categoría o coordenadas inválidas"
            });
        }

        const resultado = await pool.query(
            `SELECT
                r.id_reporte,
                r.titulo,
                r.ubicacion,
                r.id_estado,
                e.nombre AS estado,
                r.fecha_creacion,
                ROUND((
                    6371000 * 2 * ASIN(
                        LEAST(1, SQRT(
                            POWER(SIN(RADIANS(
                                (r.latitud - $2) / 2
                            )), 2)
                            +
                            COS(RADIANS($2))
                            * COS(RADIANS(r.latitud))
                            * POWER(SIN(RADIANS(
                                (r.longitud - $3) / 2
                            )), 2)
                        ))
                    )
                )::numeric, 1) AS distancia_metros
             FROM reportes r
             INNER JOIN estados_reporte e
                ON r.id_estado = e.id_estado
             WHERE r.id_tipo = $1
               AND r.id_estado IN (1, 2, 3)
               AND r.latitud IS NOT NULL
               AND r.longitud IS NOT NULL
               AND r.latitud BETWEEN -90 AND 90
               AND r.longitud BETWEEN -180 AND 180
             ORDER BY distancia_metros ASC`,
            [tipo, lat, lon]
        );

        const similares = resultado.rows.filter(
            (reporte) => Number(reporte.distancia_metros) <= 30
        );

        res.status(200).json({ similares });

    } catch (error) {
        console.error("Error al buscar incidencias similares:", error);

        res.status(500).json({
            mensaje: "Error al buscar incidencias similares"
        });
    }
});


// Permitir que un ciudadano se sume a una incidencia existente
router.post("/:id/sumarse", verificarToken, async (req, res) => {
    const idReporte = Number(req.params.id);
    const idUsuario = req.usuario.id_usuario;

    if (!Number.isInteger(idReporte) || idReporte <= 0) {
        return res.status(400).json({
            mensaje: "El ID del reporte no es válido"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Bloquear el reporte mientras se realiza la operación
        const resultado = await client.query(
            `SELECT id_reporte, id_usuario, id_estado,
                    fecha_ultima_actividad
             FROM reportes
             WHERE id_reporte = $1
             FOR UPDATE`,
            [idReporte]
        );

        if (resultado.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                mensaje: "El reporte no existe"
            });
        }

        const reporte = resultado.rows[0];

        // Solo se permite sumarse a reportes activos
        if (![1, 2, 3].includes(reporte.id_estado)) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                mensaje: "No podés sumarte a un reporte que no está activo"
            });
        }

        // No permitir que el creador se sume a su propio reporte
        if (Number(reporte.id_usuario) === Number(idUsuario)) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                mensaje: "Ya sos el creador de esta incidencia"
            });
        }

        // Comprobar si el usuario ya se sumó
        const seguimientoExistente = await client.query(
            `SELECT id_seguimiento
             FROM seguimiento_reportes
             WHERE id_reporte = $1 AND id_usuario = $2`,
            [idReporte, idUsuario]
        );

        if (seguimientoExistente.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                mensaje: "Ya te sumaste a esta incidencia"
            });
        }

        // Registrar al ciudadano
        await client.query(
            `INSERT INTO seguimiento_reportes
                (id_reporte, id_usuario)
             VALUES ($1, $2)`,
            [idReporte, idUsuario]
        );

        // Renovar la fecha de actividad
        await client.query(
            `UPDATE reportes
             SET fecha_ultima_actividad = CURRENT_TIMESTAMP
             WHERE id_reporte = $1`,
            [idReporte]
        );

        // Contar al creador original y a los ciudadanos sumados
        const cantidad = await client.query(
            `SELECT COUNT(*)::integer + 1 AS total_ciudadanos
             FROM seguimiento_reportes
             WHERE id_reporte = $1`,
            [idReporte]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            mensaje: "Te sumaste correctamente a esta incidencia",
            total_ciudadanos: cantidad.rows[0].total_ciudadanos
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Error al sumarse a la incidencia:", error);

        return res.status(500).json({
            mensaje: "Error al sumarse a la incidencia"
        });

    } finally {
        client.release();
    }
});


router.post("/:id/denunciar", verificarToken, async (req, res) => {
    try {
        const idReporte = Number(req.params.id);
        const idUsuario = req.usuario.id_usuario;
        const { motivo, descripcion } = req.body || {};

        // Validar ID del reporte
        if (!Number.isSafeInteger(idReporte) || idReporte <= 0) {
            return res.status(400).json({
                mensaje: "El ID del reporte no es válido"
            });
        }

        // Validar motivo
        const motivosValidos = [
            "informacion_falsa",
            "ubicacion_incorrecta",
            "contenido_inapropiado",
            "otro"
        ];

        if (!motivosValidos.includes(motivo)) {
            return res.status(400).json({
                mensaje: "Seleccioná un motivo de denuncia válido"
            });
        }

        // Validar descripción opcional
        if (
            descripcion !== undefined &&
            descripcion !== null &&
            typeof descripcion !== "string"
        ) {
            return res.status(400).json({
                mensaje: "La descripción no es válida"
            });
        }

        const textoDescripcion =
            typeof descripcion === "string" ? descripcion.trim() : "";

        if (textoDescripcion.length > 500) {
            return res.status(400).json({
                mensaje: "La descripción no puede superar los 500 caracteres"
            });
        }

        // Verificar que exista el reporte
        const resultado = await pool.query(
            `SELECT id_reporte, id_usuario
             FROM reportes
             WHERE id_reporte = $1`,
            [idReporte]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: "El reporte no existe"
            });
        }

        // No permitir denunciar un reporte propio
        if (Number(resultado.rows[0].id_usuario) === Number(idUsuario)) {
            return res.status(403).json({
                mensaje: "No podés denunciar tu propio reporte"
            });
        }

        // Registrar denuncia, evitando duplicados
        const denuncia = await pool.query(
            `INSERT INTO denuncias_reportes
                (id_reporte, id_usuario, motivo, descripcion)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id_reporte, id_usuario) DO NOTHING
             RETURNING id_denuncia, estado`,
            [
                idReporte,
                idUsuario,
                motivo,
                textoDescripcion || null
            ]
        );

        if (denuncia.rows.length === 0) {
            return res.status(409).json({
                mensaje: "Ya denunciaste este reporte anteriormente"
            });
        }

        return res.status(201).json({
            mensaje: "Denuncia enviada correctamente. Quedó pendiente de revisión.",
            denuncia: denuncia.rows[0]
        });

    } catch (error) {
        console.error("Error al denunciar el reporte:", error);

        return res.status(500).json({
            mensaje: "Error al registrar la denuncia"
        });
    }
});


router.get("/:id/estado-denuncia", verificarToken, async (req, res) => {
    try {
        const idReporte = Number(req.params.id);
        const idUsuario = req.usuario.id_usuario;

        if (!Number.isSafeInteger(idReporte) || idReporte <= 0) {
            return res.status(400).json({
                mensaje: "El ID del reporte no es válido"
            });
        }

        const resultado = await pool.query(
            `SELECT EXISTS (
                SELECT 1
                FROM denuncias_reportes
                WHERE id_reporte = $1
                  AND id_usuario = $2
            ) AS ya_denunciado`,
            [idReporte, idUsuario]
        );

        return res.status(200).json({
            ya_denunciado: resultado.rows[0].ya_denunciado
        });

    } catch (error) {
        console.error("Error al consultar la denuncia:", error);

        return res.status(500).json({
            mensaje: "Error al consultar el estado de la denuncia"
        });
    }
});


// Consultar los reportes del usuario autenticado
router.get("/mis-reportes", verificarToken, async (req, res) => {
    try {
        const id_usuario = req.usuario.id_usuario;

        const resultado = await pool.query(
            `SELECT
                r.*,
                t.nombre AS tipo_incidencia,
                e.nombre AS estado
             FROM reportes r
             INNER JOIN tipo_incidencia t
                ON r.id_tipo = t.id_tipo
             INNER JOIN estados_reporte e
                ON r.id_estado = e.id_estado
             WHERE r.id_usuario = $1
             ORDER BY r.fecha_creacion DESC, r.id_reporte DESC`,
            [id_usuario]
        );

        res.status(200).json({
            reportes: resultado.rows
        });

    } catch (error) {
        console.error("Error al consultar mis reportes:", error);

        res.status(500).json({
            mensaje: "Error al consultar los reportes"
        });
    }
});


// Consultar los reportes para el mapa de incidencias
router.get("/mapa", verificarToken, async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                r.id_reporte,
                r.id_tipo,
                r.id_estado,
                r.titulo,
                r.descripcion,
                r.ubicacion,
                r.latitud,
                r.longitud,
                r.fecha_creacion,
                t.nombre AS tipo_incidencia,
                e.nombre AS estado,
                u.nombre AS nombre_usuario,
                CASE
                    WHEN r.id_usuario = $1
                        OR EXISTS (
                            SELECT 1
                            FROM seguimiento_reportes s2
                            WHERE s2.id_reporte = r.id_reporte
                            AND s2.id_usuario = $1
                        )
                    THEN TRUE
                    ELSE FALSE
                END AS ya_reportado,

                (
                    SELECT COUNT(*)::integer + 1
                    FROM seguimiento_reportes s
                    WHERE s.id_reporte = r.id_reporte
                ) AS total_ciudadanos
            FROM reportes r
            INNER JOIN tipo_incidencia t
                ON r.id_tipo = t.id_tipo
            INNER JOIN estados_reporte e
                ON r.id_estado = e.id_estado
            INNER JOIN usuarios u
                ON r.id_usuario = u.id_usuario
            WHERE r.latitud IS NOT NULL
              AND r.longitud IS NOT NULL
              AND r.latitud BETWEEN -90 AND 90
              AND r.longitud BETWEEN -180 AND 180
            ORDER BY r.fecha_creacion DESC, r.id_reporte DESC
            `, [req.usuario.id_usuario]);

        res.status(200).json({
            reportes: resultado.rows
        });

    } catch (error) {
        console.error("Error al consultar reportes del mapa:", error);

        res.status(500).json({
            mensaje: "Error al consultar las incidencias del mapa"
        });
    }
});


// Consultar el detalle de un reporte por ID
router.get("/:id", verificarToken, async (req, res) => {
    try {
        const id_reporte = Number(req.params.id);

        if (!Number.isSafeInteger(id_reporte) || id_reporte <= 0) {
            return res.status(400).json({
                mensaje: "El ID del reporte no es válido"
            });
        }

        const resultado = await pool.query(
            `SELECT
                r.*,
                t.nombre AS tipo_incidencia,
                e.nombre AS estado
             FROM reportes r
             INNER JOIN tipo_incidencia t
                ON r.id_tipo = t.id_tipo
             INNER JOIN estados_reporte e
                ON r.id_estado = e.id_estado
             WHERE r.id_reporte = $1`,
            [id_reporte]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: "El reporte no existe"
            });
        }

        res.status(200).json({
            reporte: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al consultar el detalle:", error);

        res.status(500).json({
            mensaje: "Error al consultar el reporte"
        });
    }
});

// Consultar el historial de cambios de un reporte
router.get("/:id/historial", verificarToken, async (req, res) => {
    try {
        const id_reporte = Number(req.params.id);

        if (!Number.isSafeInteger(id_reporte) || id_reporte <= 0) {
            return res.status(400).json({
                mensaje: "El ID del reporte no es válido"
            });
        }

        // Verificar que el reporte exista
        const reporteExistente = await pool.query(
            "SELECT id_reporte FROM reportes WHERE id_reporte = $1",
            [id_reporte]
        );

        if (reporteExistente.rows.length === 0) {
            return res.status(404).json({
                mensaje: "El reporte no existe"
            });
        }

        // Obtener los cambios registrados
        const resultado = await pool.query(
            `SELECT
                h.id_historial,
                h.id_reporte,
                e.nombre AS estado,
                h.comentario,
                h.fecha_cambio
             FROM historial_reportes h
             INNER JOIN estados_reporte e
                ON h.id_estado = e.id_estado
             WHERE h.id_reporte = $1
             ORDER BY h.fecha_cambio ASC, h.id_historial ASC`,
            [id_reporte]
        );

        res.status(200).json({
            historial: resultado.rows
        });

    } catch (error) {
        console.error("Error al consultar el historial:", error);

        res.status(500).json({
            mensaje: "Error al consultar el historial del reporte"
        });
    }
});

// Permitir que el propietario marque su reporte como resuelto
router.patch("/:id/resolver", verificarToken, async (req, res) => {
    const id_reporte = Number(req.params.id);
    const id_usuario = req.usuario.id_usuario;

    if (!Number.isSafeInteger(id_reporte) || id_reporte <= 0) {
        return res.status(400).json({
            mensaje: "El ID del reporte no es válido"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Buscar el reporte y bloquearlo durante la operación
        const resultado = await client.query(
            `SELECT id_reporte, id_usuario, id_estado
             FROM reportes
             WHERE id_reporte = $1
             FOR UPDATE`,
            [id_reporte]
        );

        if (resultado.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                mensaje: "El reporte no existe"
            });
        }

        const reporte = resultado.rows[0];

        // Solo el creador puede resolverlo
        if (Number(reporte.id_usuario) !== Number(id_usuario)) {
            await client.query("ROLLBACK");

            return res.status(403).json({
                mensaje: "No tienes permiso para resolver este reporte"
            });
        }

        // Estado 4 = Resuelto
        if (Number(reporte.id_estado) === 4) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                mensaje: "Este reporte ya está resuelto"
            });
        }

        // Actualizar el estado del reporte
        await client.query(
            `UPDATE reportes
             SET id_estado = $1
             WHERE id_reporte = $2`,
            [4, id_reporte]
        );

        // Notificar al creador y a los ciudadanos sumados
        await notificarCambioEstado(
            client,
            id_reporte,
            "Resuelto"
        );

        // Registrar el cambio en el historial
        await client.query(
            `INSERT INTO historial_reportes
                (id_reporte, id_estado, id_usuario, comentario)
             VALUES ($1, $2, $3, $4)`,
            [
                id_reporte,
                4,
                id_usuario,
                "El propietario marcó el reporte como resuelto."
            ]
        );

        await client.query("COMMIT");

        res.status(200).json({
            mensaje: "Reporte marcado como resuelto correctamente"
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Error al resolver el reporte:", error);

        res.status(500).json({
            mensaje: "Error al resolver el reporte"
        });

    } finally {
        client.release();
    }
});

// Avisar que una incidencia de otro ciudadano fue solucionada
router.post("/:id/aviso-resolucion", verificarToken, async (req, res) => {
    try {
        const id_reporte = Number(req.params.id);
        const id_usuario = Number(req.usuario.id_usuario);

        if (!Number.isSafeInteger(id_reporte) || id_reporte <= 0) {
            return res.status(400).json({
                mensaje: "El ID del reporte no es válido"
            });
        }

        const resultado = await pool.query(
            `SELECT id_reporte, id_usuario, id_estado
             FROM reportes
             WHERE id_reporte = $1`,
            [id_reporte]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                mensaje: "El reporte no existe"
            });
        }

        const reporte = resultado.rows[0];

        if (Number(reporte.id_usuario) === id_usuario) {
            return res.status(403).json({
                mensaje: "Para resolver tu propio reporte utilizá la opción Marcar como resuelto"
            });
        }

        if (Number(reporte.id_estado) === 4) {
            return res.status(409).json({
                mensaje: "Este reporte ya está resuelto"
            });
        }

        // Permitir un nuevo aviso cada 7 días por ciudadano y reporte
        const avisoReciente = await pool.query(
            `SELECT id_notificacion
     FROM notificaciones
     WHERE id_reporte = $1
       AND id_usuario_emisor = $2
       AND tipo = 'aviso_resolucion'
       AND fecha_hora > CURRENT_TIMESTAMP - INTERVAL '7 days'
     LIMIT 1`,
            [id_reporte, id_usuario]
        );

        if (avisoReciente.rows.length > 0) {
            return res.status(409).json({
                mensaje: "Ya enviaste un aviso para este reporte. Podrás enviar otro después de 7 días."
            });
        }

        // Guardar el aviso sin cambiar el estado del reporte
        await pool.query(
            `INSERT INTO notificaciones
                (id_usuario, id_reporte, titulo, mensaje,
                 id_usuario_emisor, tipo, estado_revision)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                id_usuario,
                id_reporte,
                "Aviso de incidencia solucionada",
                "Un ciudadano informó que esta incidencia ya fue solucionada.",
                id_usuario,
                "aviso_resolucion",
                "pendiente"
            ]
        );

        res.status(201).json({
            mensaje: "Aviso enviado correctamente. Quedará pendiente de revisión."
        });

    } catch (error) {
        console.error("Error al enviar aviso de resolución:", error);

        res.status(500).json({
            mensaje: "Error al enviar el aviso"
        });
    }
});

// Consultar cuándo puede volver a enviar un aviso
router.get("/:id/estado-aviso", verificarToken, async (req, res) => {
    try {
        const id_reporte = Number(req.params.id);
        const id_usuario = req.usuario.id_usuario;

        if (!Number.isSafeInteger(id_reporte) || id_reporte <= 0) {
            return res.status(400).json({
                mensaje: "El ID del reporte no es válido"
            });
        }

        const reporte = await pool.query(
            "SELECT id_reporte FROM reportes WHERE id_reporte = $1",
            [id_reporte]
        );

        if (reporte.rows.length === 0) {
            return res.status(404).json({
                mensaje: "El reporte no existe"
            });
        }

        const resultado = await pool.query(
            `SELECT
                fecha_hora + INTERVAL '7 days' AS proximo_aviso,
                (fecha_hora + INTERVAL '7 days' > CURRENT_TIMESTAMP)
                    AS debe_esperar
             FROM notificaciones
             WHERE id_reporte = $1
               AND id_usuario_emisor = $2
               AND tipo = 'aviso_resolucion'
             ORDER BY fecha_hora DESC, id_notificacion DESC
             LIMIT 1`,
            [id_reporte, id_usuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(200).json({
                puede_avisar: true,
                proximo_aviso: null
            });
        }

        const aviso = resultado.rows[0];

        res.status(200).json({
            puede_avisar: !aviso.debe_esperar,
            proximo_aviso: aviso.proximo_aviso
        });

    } catch (error) {
        console.error("Error al consultar el estado del aviso:", error);

        res.status(500).json({
            mensaje: "Error al consultar el estado del aviso"
        });
    }
});

module.exports = router;
module.exports.revisarReportesInactivos = revisarReportesInactivos;
