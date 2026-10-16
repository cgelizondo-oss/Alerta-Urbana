
async function notificarCambioEstado(client, idReporte, nuevoEstado) {
    // Obtener el creador del reporte
    const resultado = await client.query(
        `SELECT id_usuario, titulo
         FROM reportes
         WHERE id_reporte = $1`,
        [idReporte]
    );

    if (resultado.rows.length === 0) {
        throw new Error("No se encontró el reporte para notificar");
    }

    const reporte = resultado.rows[0];

    // Obtener al creador y a los ciudadanos sumados
    const destinatarios = await client.query(
        `SELECT id_usuario
         FROM (
             SELECT id_usuario
             FROM reportes
             WHERE id_reporte = $1

             UNION

             SELECT id_usuario
             FROM seguimiento_reportes
             WHERE id_reporte = $1
         ) AS usuarios`,
        [idReporte]
    );

    // Crear una notificación para cada destinatario
    for (const usuario of destinatarios.rows) {
        await client.query(
            `INSERT INTO notificaciones
                (id_usuario, id_reporte, titulo, mensaje, leida, tipo)
             VALUES ($1, $2, $3, $4, FALSE, $5)`,
            [
                usuario.id_usuario,
                idReporte,
                "Cambio de estado de tu reporte",
                `El reporte "${reporte.titulo}" cambió su estado a ${nuevoEstado}.`,
                "cambio_estado"
            ]
        );
    }
}

module.exports = { notificarCambioEstado };
