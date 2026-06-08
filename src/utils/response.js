import { DiccionarioMensajes } from '../config/mensajes.js';

/**
 * estructura estado HTTP.
 * @param {string} claveMensaje 
 * @param {any} [data=null] 
 */
export const enviarRespuesta = (claveMensaje, data = null) => {
    const plantilla = DiccionarioMensajes[claveMensaje] || { code: 500, message: 'Error desconocido' };
    
    const respuesta = {
        code: plantilla.code,
        message: plantilla.message
    };

    if (data !== null && (plantilla.code === 200 || plantilla.code === 201)) {
        respuesta.data = data;
    }

    return respuesta;
};