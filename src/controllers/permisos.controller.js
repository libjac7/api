import db from '../config/db.js';
import { enviarRespuesta } from '../utils/response.js';

export const gestionarExcepcionesMasivas = async (req, res) => {
    const { id_us, modificaciones } = req.body; 

    // VALIDACIÓN DE PARÁMETROS GENERALES
    if (!id_us || !modificaciones || !Array.isArray(modificaciones) || modificaciones.length === 0) {
        return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES', { 
            message: "Se requiere el id_us y un arreglo 'modificaciones' con al menos un elemento." 
        }));
    }

    try {
// RECUPERAR Y VALIDAR QUE EL USUARIO DESTINO EXISTA
        const [usuarioData] = await db.query('SELECT id_emp FROM usuarios WHERE id_us = ?', [id_us ? id_us.trim() : '']);
        
        // Valida de forma estricta si el arreglo esta vacio
        if (!usuarioData || usuarioData.length === 0) {
            console.warn(`⚠️ADVERTENCIA: Intento de modificar permisos para un id_us inexistente: [${id_us}]`);
            
            //  RETORNO DIRECTO NATIVO: Evita que intermediarios fuercen un codigo 500 erroneo
            return res.status(404).json({
                code: 404,
                message: `El ID de usuario destino [${id_us || 'vacío'}] no existe en el sistema.`
            });
        }
        
        const id_emp = usuarioData[0].id_emp;

        // CAPTURAR DATOS DEL OPERADOR DESDE EL JWT
        const id_operador = req.user?.id || req.user?.id_usuario || req.user?.id_us;
        const rol_operador = req.user?.rol; // Extrae el rol (ej: 'Administrador', 'Supervisor')

        if (!id_operador) {
            return res.status(401).json(enviarRespuesta('UNAUTHORIZED', { 
                message: "No se pudo identificar las credenciales del operador en el token." 
            }));
        }

        // VALIDACION DE SEGURIDAD HIBRIDA (Rol Administrador o Excepcion en Tabla)
        let tienePermisoOtorgar = false;

        if (rol_operador && rol_operador.trim().toLowerCase() === 'administrador') {
            // Regla por defecto: Si es Administrador puede realizar la transaccion
            tienePermisoOtorgar = true;
        } else {
            // Regla por excepcion: Si no es Admin, buscamos si tiene el permiso 38 ('OTORGAR_PERMISOS') concedido
            const queryVerificarExcepcion = `
                SELECT 1 FROM usuario_permisos up
                INNER JOIN permisos p ON up.id_per = p.id_per
                WHERE up.id_us = ? AND p.name_per = 'OTORGAR_PERMISOS' AND up.permitido = 1
                LIMIT 1
            `;
            const [excepcionData] = await db.query(queryVerificarExcepcion, [id_operador]);
            if (excepcionData.length > 0) {
                tienePermisoOtorgar = true;
            }
        }

        if (!tienePermisoOtorgar) {
            console.warn(`ACCESO DENEGADO: El operador [${id_operador}] con Rol [${rol_operador}] intentó asignar permisos sin autorización.`);
            return res.status(403).json(enviarRespuesta('FORBIDDEN', { 
                message: "Operación rechazada. Su usuario no posee los privilegios necesarios ni el permiso 'OTORGAR_PERMISOS' para delegar o revocar accesos." 
            }));
        }

        console.log(`Iniciando procesamiento de permisos para el usuario: [${id_us}] | Operador: [${id_operador}] (${rol_operador})`);

        // MAPEO Y EJECUCION ASINCRONA DEL LOTE DE MODIFICACIONES
        const promesasOperaciones = modificaciones.map(async (cambio, index) => {
            const { name_per, accion } = cambio;

            if (!name_per || !accion) {
                throw new Error(`CAMPOS_INCOMPLETOS: El ítem en la posición ${index} carece de 'name_per' o 'accion'.`);
            }

            const accionUpper = accion.toUpperCase().trim();
            if (accionUpper !== 'CONCEDER' && accionUpper !== 'DENEGAR' && accionUpper !== 'RESTABLECER') {
                throw new Error(`ACCION_INVALIDA: La acción '${accion}' en el permiso '${name_per}' no es válida. Use CONCEDER, DENEGAR o RESTABLECER.`);
            }

            // Validar si el permiso solicitado existe en la tabla 'permisos'
            const [permisoData] = await db.query('SELECT id_per FROM permisos WHERE name_per = ?', [name_per.trim()]);
            if (permisoData.length === 0) {
                throw new Error(`PERMISO_NO_EXISTE: El permiso con nombre '${name_per}' no existe en el catálogo del sistema.`);
            }
            const id_per = permisoData[0].id_per;

            // OPERACION A: RESTABLECER -> Eliminar la fila de la PK compuesta
            if (accionUpper === 'RESTABLECER') {
                const queryDelete = `DELETE FROM usuario_permisos WHERE id_us = ? AND id_per = ? AND id_emp = ?;`;
                await db.query(queryDelete, [id_us.trim(), id_per, id_emp]);
                return { name_per, estado: 'RESTABLECIDO' };
            }

            // OPERACION B: CONCEDER / DENEGAR -> Insert o Update (Upsert)
            const valorPermitido = (accionUpper === 'CONCEDER') ? 1 : 0;
            const queryUpsert = `
                INSERT INTO usuario_permisos (id_us, id_per, id_emp, permitido)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    permitido = VALUES(permitido),
                    datetime_asig_per = CURRENT_TIMESTAMP;
            `;
            await db.query(queryUpsert, [id_us.trim(), id_per, id_emp, valorPermitido]);
            return { name_per, estado: accionUpper };
        });

        // Ejecución en paralelo
        const resultadosLote = await Promise.all(promesasOperaciones);

        return res.status(200).json(enviarRespuesta('EXITO', { 
            message: 'Todas las modificaciones de permisos se procesaron correctamente.',
            detalles: resultadosLote
        }));

    } catch (error) {
        console.error("ERROR EN LA GESTION DE PERMISOS:", error.message);
        
        if (
            error.message.includes('PERMISO_NO_EXISTE') || 
            error.message.includes('ACCION_INVALIDA') || 
            error.message.includes('CAMPOS_INCOMPLETOS')
        ) {
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS', { 
                message: error.message 
            }));
        }
        
        return res.status(500).json(enviarRespuesta('ERROR_SERVIDOR', {
            message: "Error crítico interno en el servidor al escribir las excepciones de permisos.",
            error_developer: error.message
        }));
    }
};