import db from '../config/db.js';
import { enviarRespuesta } from '../utils/response.js';

export const gestionarExcepcionesMasivas = async (req, res) => {
    const { id_us, modificaciones } = req.body; 

    // VALIDACIÓN DE PARÁMETROS GENERALES
    if (!id_us || !modificaciones || !Array.isArray(modificaciones) || modificaciones.length === 0) {
        return res.status(400).json({
            code: 400,
            message: "Se requiere el id_us y un arreglo 'modificaciones' con al menos un elemento."
        });
    }

    try {
        // RECUPERAR Y VALIDAR QUE EL USUARIO DESTINO EXISTA
        const [usuarioData] = await db.query('SELECT id_emp FROM usuarios WHERE id_us = ?', [id_us ? id_us.trim() : '']);
        
        if (!usuarioData || usuarioData.length === 0) {
            console.warn(`⚠️ ADVERTENCIA: Intento de modificar permisos para un id_us inexistente: [${id_us}]`);
            return res.status(404).json({
                code: 404,
                message: `El ID de usuario destino [${id_us || 'vacío'}] no existe en el sistema.`
            });
        }
        
        const id_emp = usuarioData[0].id_emp;

        // CAPTURAR DATOS DEL OPERADOR DESDE EL JWT
        const id_operador = req.user?.id || req.user?.id_usuario || req.user?.id_us;
        const rol_operador = req.user?.rol; 

        if (!id_operador) {
            return res.status(401).json({
                code: 401,
                message: "No se pudo identificar las credenciales del operador (Administrador) en el token."
            });
        }

        // 4VALIDACION DE SEGURIDAD (Rol Administrador o Excepción en Tabla)
        let tienePermisoOtorgar = false;

        if (rol_operador && rol_operador.trim().toLowerCase() === 'administrador') {
            tienePermisoOtorgar = true;
        } else {
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

        // Si no cuenta con el permiso, responde con un 403 real en JSON
        if (!tienePermisoOtorgar) {
            console.warn(`ACCESO DENEGADO: El operador [${id_operador}] con Rol [${rol_operador}] intentó operar la ruta sin el permiso: [OTORGAR_PERMISOS]`);
            return res.status(403).json({
                code: 403,
                message: "No cuenta con el permiso requerido: [OTORGAR_PERMISOS] para realizar esta operación."
            });
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

            // OPERACIÓN A: RESTABLECER
            if (accionUpper === 'RESTABLECER') {
                const queryDelete = `DELETE FROM usuario_permisos WHERE id_us = ? AND id_per = ? AND id_emp = ?;`;
                await db.query(queryDelete, [id_us.trim(), id_per, id_emp]);
                return { name_per, estado: 'RESTABLECIDO' };
            }

            // OPERACIÓN B: CONCEDER / DENEGAR
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
            return res.status(400).json({
                code: 400,
                message: error.message
            });
        }
        
        return res.status(500).json({
            code: 500,
            message: "Error crítico interno en el servidor al escribir las excepciones de permisos.",
            error_developer: error.message
        });
    }
};
export const obtenerExcepcionesUsuario = async (req, res) => {
  const { id_us } = req.params;

  try {
    // Validacion de entrada de seguridad
    if (!id_us || String(id_us).trim() === '') {
      return res.status(400).json({
        code: 400,
        message: "El parámetro id_us es mandatorio."
      });
    }

    // Ejecuta SP
    const [rows] = await db.query('CALL sp_obtener_matriz_permisos_usuario(?)', [id_us]);
    const datasetPermisos = rows[0] || [];

    // Resultado
    const excepcionesFormateadas = datasetPermisos.map(item => {
      let esAdicional = false;
      let esDenegado = false;

      // Si hay un registro en la tabla usuario_permisos (estado_excepcion no es null)
      if (item.estado_excepcion !== null) {
        if (item.estado_excepcion === 0 && item.pertenece_al_rol === 1) {
          esDenegado = true; // Era de su rol pero se lo quitaron 
        } else if (item.estado_excepcion === 1 && item.pertenece_al_rol === 0) {
          esAdicional = true; // No era de su rol pero se lo regalaron 
        }
      }

      return {
        name_per: item.name_per,
        permitido: item.estado_excepcion !== null ? item.estado_excepcion : item.pertenece_al_rol,
        es_adicional: esAdicional,
        es_denegado: esDenegado
      };
    });

    return res.status(200).json({
      code: 200,
      message: "Matriz de seguridad procesada.",
      data: {
        id_us,
        excepciones: excepcionesFormateadas
      }
    });

  } catch (error) {
    console.error("Error en obtenerExcepcionesUsuario:", error.message);

    if (error.message?.includes('ERROR_USUARIO_NO_EXISTE')) {
      return res.status(444).json({ code: 444, message: "El usuario ingresado no existe en el sistema." });
    }
    if (error.message?.includes('ERROR_USUARIO_INACTIVO')) {
      return res.status(403).json({ code: 403, message: "Operación denegada. El usuario se encuentra inactivo." });
    }

    return res.status(500).json({
      code: 500,
      message: "Error interno del servidor al procesar la matriz de accesos."
    });
  }
};