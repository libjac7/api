import db from '../config/db.js';
import { enviarRespuesta } from '../utils/response.js';

export const gestionarExcepcionesMasivas = async (req, res) => {
    const { id_us, modificaciones } = req.body; 

    // Se pueden condecer o no varios permisos a la vez [{ name_per: 'CREAR_CLIENTES', accion: 'CONCEDER' }, { name_per: 'VER_RUTAS', accion: 'RESTABLECER' }]

    // VALIDACIÓN DE PARÁMETROS
    if (!id_us || !modificaciones || !Array.isArray(modificaciones) || modificaciones.length === 0) {
        return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES', { message: "Se requiere el id_us y un arreglo 'modificaciones' con al menos un elemento." }));
    }

    try {
        // SE RECUPERA EL ID DE EMPLEADO 
        const [usuarioData] = await db.query('SELECT id_emp FROM usuarios WHERE id_us = ?', [id_us.trim()]);
        if (usuarioData.length === 0) {
            return res.status(404).json(enviarRespuesta('NOT_FOUND', { message: 'El ID de usuario especificado no existe.' }));
        }
        
        const id_emp = usuarioData[0].id_emp;
        const id_operador = req.user?.id_usuario || req.user?.id_us || req.user?.id;

        console.log(`Iniciando procesamiento de permisos para el usuario: [${id_us}] | Total de cambios: ${modificaciones.length}`);

        // SE MAPEAN CUANTAS OPERACIONES SE REALIZARAN Y SE EJECUTARAN
        const promesasOperaciones = modificaciones.map(async (cambio) => {
            const { name_per, accion } = cambio;

            if (!name_per || !accion) {
                throw new Error(`CAMPOS_INCOMPLETOS_EN_ITEM`);
            }

            const accionUpper = accion.toUpperCase().trim();
            if (accionUpper !== 'CONCEDER' && accionUpper !== 'DENEGAR' && accionUpper !== 'RESTABLECER') {
                throw new Error(`ACCION_INVALIDA_EN_ITEM: ${accion}`);
            }

            // Buscamos el id_per del permiso actual del lote
            const [permisoData] = await db.query('SELECT id_per FROM permisos WHERE name_per = ?', [name_per.trim()]);
            if (permisoData.length === 0) {
                throw new Error(`PERMISO_NO_EXISTE: ${name_per}`);
            }
            const id_per = permisoData[0].id_per;

            // OPERACION A: RESTABLECER -> Elimina la fila del permiso actual
            if (accionUpper === 'RESTABLECER') {
                const queryDelete = `DELETE FROM usuario_permisos WHERE id_us = ? AND id_per = ?;`;
                await db.query(queryDelete, [id_us.trim(), id_per]);
                return { name_per, estado: 'RESTABLECIDO' };
            }

            // OPERACION B: CONCEDER / DENEGAR 
            const valorPermitido = (accionUpper === 'CONCEDER') ? 1 : 0;
            const queryUpsert = `
                INSERT INTO usuario_permisos (id_us, id_per, id_emp, asignado_por, permitido)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    permitido = VALUES(permitido),
                    asignado_por = VALUES(asignado_por),
                    datetime_asig_per = CURRENT_TIMESTAMP;
            `;
            await db.query(queryUpsert, [id_us.trim(), id_per, id_emp, id_operador, valorPermitido]);
            return { name_per, estado: accionUpper };
        });

        // Se ejecuta el lote de manera asincrona
        const resultadosLote = await Promise.all(promesasOperaciones);

        return res.status(200).json(enviarRespuesta('EXITO', { 
            message: 'Todas las modificaciones de permisos se procesaron correctamente.',
            detalles: resultadosLote
        }));

    } catch (error) {
        console.error("Error critico en la gestion de permisos:", error.message);
        
        if (error.message.includes('PERMISO_NO_EXISTE') || error.message.includes('ACCION_INVALIDA')) {
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS', { message: error.message }));
        }
        
        return res.status(500).json(enviarRespuesta('ERROR_SERVIDOR'));
    }
};