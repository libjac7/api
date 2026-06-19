import bcrypt from 'bcrypt';
import db from '../config/db.js';

export const cambiarPassword = async (req, res) => {
    // Validacion de credenciales inyectadas desde el Token JWT
    const idUsAutenticado = req.user?.id_usuario || req.user?.id;
    const rolCrudo = req.user && req.user.rol ? req.user.rol : '';
    const rolOperador = rolCrudo.trim().toLowerCase();
    
    // Se recupera la lista de permisos adicionales del token de sesion
    const listaPermisosOperador = req.user?.permisos || [];

    const { id } = req.params; // ID del usuario objetivo a cambiarle la contraseña
    const { nueva_pass } = req.body;

    console.log(`INTENTO DE CAMBIO DE CONTRASEÑA -> Operador: [${idUsAutenticado}] con Rol: '${rolOperador}' intentando modificar a: [${id}]`);

    if (!id || id === 'null' || id === 'undefined') {
        console.warn(`VALIDACION FALLIDA: Se intento hacer la petición sin un ID de usuario valido en la URL.`);
        return res.status(400).json({
            data: {
                code: 400,
                message: "El ID del usuario objetivo es obligatorio en la URL."
            }
        });
    }

    // REGLAS DE PRIVILEGIOS 
    const esAdministrador = (rolOperador === 'administrador');
    const esElMismoUsuario = (idUsAutenticado === id);
    
    // Se valida si posee el superpoder en el token
    const tienePermisoEspecial = listaPermisosOperador.includes('reiniciar_password_otros');

    if (esAdministrador) {
        console.log(`ACCESO CONCEDIDO: El Administrador [${idUsAutenticado}] esta modificando al usuario [${id}].`);
    } 
    else if (esElMismoUsuario) {
        console.log(`ACCESO CONCEDIDO: El usuario [${idUsAutenticado}] esta actualizando su propia contraseña.`);
    } 
    else if (tienePermisoEspecial) {
        console.log(`ACCESO CONCEDIDO: El operador [${idUsAutenticado}] posee la excepcion [REINICIAR_PASSWORD_OTROS] para modificar al usuario [${id}].`);
    } 
    else {
        console.warn(`BLOQUEO DE SEGURIDAD: El usuario [${idUsAutenticado}] con rol '${rolOperador}' intento modificar la contraseña de [${id}] sin privilegios.`);
        return res.status(403).json({ 
            data: {
                code: 403, 
                message: "No cuenta con el permiso requerido para reiniciar contraseñas de terceros." 
            }
        });
    }

    // Validacion en body
    if (!nueva_pass || typeof nueva_pass !== 'string' || nueva_pass.trim() === '') {
        return res.status(400).json({
            data: {
                code: 400,
                message: "La nueva contraseña es obligatoria y debe ser un texto válido."
            }
        });
    }

    try {
        // Obtiene la contraseña hash de bd
        const [usuarios] = await db.query('SELECT pass_us FROM usuarios WHERE id_us = ?', [id]);
        
        if (!nueva_pass || typeof nueva_pass !== 'string' || nueva_pass.trim() === '') {
        return res.status(400).json({
            data: {
                code: 400,
                message: "La nueva contraseña es obligatoria y debe ser un texto válido."
            }
        });
    }

    // Mayor o igual a 8 digitos
    if (nueva_pass.trim().length < 8) {
        console.warn(`VALIDACION FALLIDA: El operador intento setear una contraseña de menos de 8 caracteres.`);
        return res.status(400).json({
            data: {
                code: 400,
                message: "La nueva contraseña debe contar con un mínimo de 8 caracteres."
            }
        });
    }

        const hashActual = usuarios[0].pass_us;

        // Evitar la misma contraseña
        const sonIdenticas = await bcrypt.compare(nueva_pass.trim(), hashActual);
        
        if (sonIdenticas) {
            console.warn(`Intento fallido: El usuario [${id}] intento colocar la misma contraseña actual.`);
            return res.status(409).json({
                data: {
                    code: 409,
                    message: "La nueva contraseña no puede ser igual a la contraseña actual."
                }
            });
        }
        // Encript
        const saltRounds = 10;
        const passEncriptada = await bcrypt.hash(nueva_pass.trim(), saltRounds);

        // 1. Forzamos el cálculo a un entero nativo (0 o 1)
        const esCambioPorTerceros = (idUsAutenticado !== id) ? 1 : 0;
        
        console.log(`Debug de Variables -> ID: ${id}, Pass: [HASH], EsTercero: ${esCambioPorTerceros}`);

        // 2. Preparamos el Arreglo de Parámetros de forma limpia
        const parametrosSP = [id, passEncriptada, esCambioPorTerceros];

        // 3. Ejecución de la consulta pasando el arreglo explícito
        const query = `
            CALL sp_actualizar_password_usuario(?, ?, ?, @cod, @men);
            SELECT @cod AS codigo, @men AS mensaje;
        `;
        
        const [rawResult] = await db.query(query, parametrosSP);    
        const datasetSelect = rawResult.find(element => Array.isArray(element) && element[0] && 'codigo' in element[0]);
        const resultado = datasetSelect ? datasetSelect[0] : null;

        if (resultado && resultado.codigo === 1) {
            console.log(`Contraseña y token_version actualizados con exito para el usuario: [${id}]`);
            return res.status(200).json({
                data: {
                    code: 200,
                    message: "Contraseña actualizada con exito. Todas las sesiones previas han sido invalidadas."
                }
            }); 
        } else {
            console.error("ERROR INESPERADO EN RESPUESTA DE BASE DE DATOS:", resultado);
            return res.status(500).json({
                data: {
                    code: 500,
                    message: "Error interno en los registros de la base de datos."
                }
            });
        }

    } catch (error) {
        console.error("ERROR CRITICO EN CONTROLADOR DE USUARIOS:", error);
        return res.status(500).json({
            data: {
                code: 500,
                message: "Error critico interno en el servidor."
            }
        });
    }
};