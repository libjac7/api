// TODO LO RELACIONADO A CLIENTES
import crypto from 'crypto';
import db from '../config/db.js';
import { enviarRespuesta } from '../utils/response.js';

const mapearMensajeClienteBD = (msg) => {

    if (msg === 'DPI de cliente ya registrado') return 'CLIENTE_DPI_REPETIDO';
    if (msg === 'email de cliente repetido') return 'CLIENTE_EMAIL_REPETIDO';
    

    if (msg === 'El cliente ya se encuentra asignado al asesor.') return 'CLIENTE_YA_ASIGNADO_AL_ASESOR';
    if (msg === 'El usuario seleccionado no cuenta con un rol valido para gestionar cobros.') return 'ROL_DESTINO_INVALIDO';
    if (msg === 'El cliente no posee ningun credito Vigente para gestionar.') return 'CLIENTE_SIN_CREDITO_VIGENTE';
    if (msg === 'El credito vigente no cuenta con cuotas pendientes o atrasadas para cobro.') return 'CREDITO_SIN_CUOTAS_PENDIENTES';

    if (msg === 'El cliente ya cuenta con un crédito activo en este momento.') return 'CLIENTE_CON_CREDITO_ACTIVO';
    if (msg === 'El plan de financiamiento seleccionado no existe.') return 'PLAN_FINANCIAMIENTO_INVALIDO';
    if (msg === 'El cliente especificado no existe.') return 'CLIENTE_NO_EXISTE';


    return 'ERROR_INTERNO_O_CATALOGO_INVALIDO';
};

//CREAR CLIENTE

export const registrarCliente = async (req, res) => {
    // CONTROL DE ACCESO
    const rolCrudo = req.user && req.user.rol ? req.user.rol : '';
    const rolOperador = rolCrudo.trim().toLowerCase();
    const rolesPermitidos = ['gerente', 'administrador', 'secretaria'];

    if (!rolesPermitidos.includes(rolOperador)) {
        console.log(`ACCESO DENEGADO PARA EL ROL: '${rolOperador}'`);
        return res.status(403).json(enviarRespuesta('ROL_NO_AUTORIZADO'));
    }

    console.log("📥 CUERPO DE LA PETICIÓN RECIBIDO (req.body):", req.body);

    //VALIDACION DE ESTRUCTURA
    const reglasValidacion = [
        { campo: 'name_cli', valor: req.body.name_cli, tipoEsperado: 'string' },
        { campo: 'ape_cli', valor: req.body.ape_cli, tipoEsperado: 'string' },
        { campo: 'dpi_cli', valor: req.body.dpi_cli, tipoEsperado: 'string' },
        { campo: 'tel_cli_1', valor: req.body.tel_cli_1, tipoEsperado: 'string' },
        { campo: 'ref_cli', valor: req.body.ref_cli, tipoEsperado: 'string' },
        { campo: 'tel_cli_ref', valor: req.body.tel_cli_ref, tipoEsperado: 'string' },
        { campo: 'emai_cli', valor: req.body.emai_cli, tipoEsperado: 'string' },
        { campo: 'id_dep', valor: req.body.id_dep, tipoEsperado: 'number' },
        { campo: 'id_muni', valor: req.body.id_muni, tipoEsperado: 'number' },
        { campo: 'zona_cli', valor: req.body.zona_cli, tipoEsperado: 'number' },
        { campo: 'direc_cli', valor: req.body.direc_cli, tipoEsperado: 'string' },
        { campo: 'id_est', valor: req.body.id_est, tipoEsperado: 'number' }
    ];

    for (const regla of reglasValidacion) {
        if (regla.valor === null || regla.valor === undefined || (regla.tipoEsperado === 'string' && regla.valor.trim() === '')) {
            console.error(`VALIDACION FALLIDA: El parametro [${regla.campo}] falta o esta vacio.`);
            return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES'));
        }

        if (typeof regla.valor !== regla.tipoEsperado) {
            console.error(`VALIDACION FALLIDA: El parametro [${regla.campo}] se esperaba como ${regla.tipoEsperado} pero llego como ${typeof regla.valor}.`);
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS'));
        }
    }

    if (req.body.inf_adi_cli !== null && req.body.inf_adi_cli !== undefined) {
        if (typeof req.body.inf_adi_cli !== 'string') {
            console.error("VALIDACIÓN FALLIDA: inf_adi_cli debe ser de tipo string.");
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS'));
        }
    }

    const {
    name_cli, ape_cli, dpi_cli, tel_cli_1, ref_cli, tel_cli_ref,
    emai_cli, id_dep, id_muni, zona_cli, direc_cli, inf_adi_cli, id_est
} = req.body;

const id_us_operador = req.user?.id_usuario || req.user?.id_us || req.user?.id;
if (!id_us_operador) {
    console.error("ERROR DE AUDITORIA: No se encontro el ID del usuario en el token JWT.");
    return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES'));
}

try {
    //Ejecución de la validacion existente en BD
    console.log("🛰️ Ejecutando sp_validar_datos_cliente...");
    const queryVal = `
        CALL sp_validar_datos_cliente(?, ?, ?, ?, ?, @cod, @men);
        SELECT @cod AS codigo, @men AS mensaje;
    `;
    const [rawResult] = await db.query(queryVal, [dpi_cli.trim(), emai_cli.trim(), id_muni, id_dep, id_est]);
    const validacion = rawResult[1][0];

    if (!validacion || validacion.codigo !== 1) {
        const claveError = validacion ? mapearMensajeClienteBD(validacion.mensaje) : 'CATALOGO_INVALIDO';
        const estatusHTTP = (claveError.includes('_REPETIDO')) ? 409 : 400;
        return res.status(estatusHTTP).json(enviarRespuesta(claveError)); 
    }

    //Genera el ID del cliente
    const id_cli = `CLI-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

    console.log(`💾 Guardando cliente transaccionalmente con ID: ${id_cli} | us_enc: NULL (Pendiente de asignación)`);
    
    //Ejecucion del SP de insercion
    const queryIns = `
        CALL sp_insertar_cliente(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @codIns, @menIns);
        SELECT @codIns AS codigo, @menIns AS mensaje;
    `;
    
    const [insertResult] = await db.query(queryIns, [
        id_cli, 
        id_us_operador, 
        null, // se esta enviando como nulo ya que se creo solamente el cliente y despues se asignara un asesor
        name_cli.trim(), 
        ape_cli.trim(), 
        dpi_cli.trim(), 
        tel_cli_1.trim(), 
        ref_cli.trim(), 
        tel_cli_ref.trim(), 
        emai_cli.trim(), 
        id_dep, 
        id_muni, 
        zona_cli, 
        direc_cli.trim(), 
        inf_adi_cli || null, 
        id_est
    ]);
    
    const insercion = insertResult[1][0];

    if (insercion && insercion.codigo === 1) {
        return res.status(201).json(enviarRespuesta('CREADO', { id_cliente: id_cli }));
    } else {
        console.error("ERROR EN INSERCION BD:", insercion);
        return res.status(500).json(enviarRespuesta('ERROR_BASE_DATOS'));
    }

} catch (error) {
    console.error("ERROR CRITICO EN CONTROLADOR:", error);
    return res.status(500).json(enviarRespuesta('ERROR_SERVIDOR'));
}
};

// ASIGNAR CLIENTE A USUARIO
export const asignarAsesorCobro = async (req, res) => {
    // CONTROL DE ACCESO
    const rolCrudo = req.user && req.user.rol ? req.user.rol : '';
    const rolOperador = rolCrudo.trim().toLowerCase();
    const rolesPermitidos = ['gerente', 'administrador', 'secretaria'];

    if (!rolesPermitidos.includes(rolOperador)) {
        console.warn(`🚫 BLOQUEO: Rol '${rolOperador}' intentó asignar asesor de cobros sin privilegios.`);
        return res.status(403).json(enviarRespuesta('ROL_NO_AUTORIZADO'));
    }

    const { id_cli, id_us_asesor } = req.body;

    if (!id_cli || !id_us_asesor) {
        return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES'));
    }

    try {
        console.log(`Evaluando requisitos de cobro para Cliente: [${id_cli}]`);

        // PROCEDIMIENTO DE VALIDACION
        const queryVal = `
            CALL sp_validar_asignacion_cobro(?, ?, @cod, @men);
            SELECT @cod AS codigo, @men AS mensaje;
        `;
        const [rawResult] = await db.query(queryVal, [id_cli.trim(), id_us_asesor.trim()]);

        const datasetSelect = rawResult.find(element => Array.isArray(element) && element[0] && 'codigo' in element[0]);
        const validacion = datasetSelect ? datasetSelect[0] : null;

if (!validacion || validacion.codigo !== 1) {
    const claveError = validacion ? mapearMensajeClienteBD(validacion.mensaje) : 'ERROR_BASE_DATOS';
    
    console.warn(`ASIGNACION RECHAZADA POR REGLA DE NEGOCIO: [${claveError}] - ${validacion?.mensaje}`);
    
    //codigo de error correcto
    const statusHTTP = (validacion?.codigo === 3 || validacion?.codigo === 4) ? 404 : 409;
    
    // Respuesta
    return res.status(statusHTTP).json({
        data: {
            code: statusHTTP,
            message: claveError
        }
    });
}
    //Si la validacion fue exitosa se realiza la actualizacion del us_enc y asignarle el recibido
        const queryUpdate = `
            UPDATE clientes 
            SET us_enc = ? 
            WHERE id_cli = ?;
        `;
        await db.query(queryUpdate, [id_us_asesor.trim(), id_cli.trim()]);

        console.log(`GUARDADO CON EXITO: Asesor [${id_us_asesor}] a cargo de Cliente [${id_cli}]`);

        //Respuesta
        return res.status(200).json({
            data: {
                code: 200,
                message: "OPERACION_EXITOSA",
                cliente: id_cli,
                asesor: id_us_asesor
            }
        });

    } catch (error) {
        console.error("ERROR CRÍTICO EN ASIGNACIÓN DE ASESOR COBRO:", error);
        
        // Respuesta de error
        return res.status(500).json({
            data: {
                code: 500,
                message: "ERROR_SERVIDOR"
            }
        });
    }
};

//OBTENER CLIENTE
export const obtenerInformacion = async (req, res) => {

    // Validaciones
    const idUsOperador = req.user?.id_usuario;
    const rolOperador = req.user?.rol ? req.user.rol.trim().toLowerCase() : '';

    const { id_jefe, id_asesor, id_est } = req.body;

    if (!idUsOperador || !rolOperador) {
        return res.status(401).json({
            data: { code: 401, message: "SESION_NO_VALIDA" }
        });
    }

    try {
        const filtroJefeLimpio = id_jefe && id_jefe.trim() !== '' ? id_jefe.trim() : null;
        const filtroAsesorLimpio = id_asesor && id_asesor.trim() !== '' ? id_asesor.trim() : null;
        const filtroEstadoLimpio = id_est !== undefined && id_est !== null ? parseInt(id_est) : null;

        const queryCall = `CALL gestiones.sp_obtener_informacion_clientes(?, ?, ?, ?, ?)`;
        const [rows] = await db.query(queryCall, [
            idUsOperador,
            rolOperador,
            filtroJefeLimpio,
            filtroAsesorLimpio,
            filtroEstadoLimpio
        ]);

        // Respues de BD en consola
        console.log("📊 RESPUESTA CRUDA DE MYSQL:", JSON.stringify(rows));

        const datosClientes = rows[0] || [];

        return res.status(200).json({
            data: {
                code: 200,
                message: "CLIENTES_PROCESADOS_CON_EXITO",
                count: datosClientes.length,
                clientes: datosClientes
            }
        });

    } catch (error) {
        console.error("ERROR CRITICO EN OBTENER_INFORMACION_CLIENTES:", error.message || error);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_SISTEMA_EXTRACCION" }
        });
    }
};

// ACTUALIZAR CLIENTE
export const actualizarCliente = async (req, res) => {
    // Validaciones
    const idUsOperador = req.user?.id_usuario;
    const rolOperador = req.user?.rol ? req.user.rol.trim().toLowerCase() : '';

    // Peticion esperada
    const {
        id_cli,
        name_cli,
        ape_cli,
        tel_cli_1,
        ref_cli,
        tel_cli_ref,
        emai_cli,
        id_dep,
        id_muni,
        zona_cli,
        direc_cli,
        inf_adi_cli,
        id_est
    } = req.body;

    // Seguridad segun los roles
    if (!['gerente', 'administrador', 'secretaria'].includes(rolOperador)) {
        return res.status(403).json({
            data: { 
                code: 403, 
                message: "ACCESO_DENEGADO_ROL_NO_PERMITIDO" 
            }
        });
    }

    // Validar dato requerido
    if (!id_cli) {
        return res.status(400).json({
            data: { code: 400, message: "ID_CLIENTE_REQUERIDO" }
        });
    }

    try {
        //Ejecucion de sp n BD
        const queryCall = `CALL gestiones.sp_actualizar_cliente(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        await db.query(queryCall, [
            id_cli.trim(),
            name_cli ? name_cli.trim() : '',
            ape_cli ? ape_cli.trim() : '',
            tel_cli_1 ? tel_cli_1.trim() : '',
            ref_cli ? ref_cli.trim() : '',
            tel_cli_ref ? tel_cli_ref.trim() : '',
            emai_cli ? emai_cli.trim() : '',
            id_dep ? parseInt(id_dep) : null,
            id_muni ? parseInt(id_muni) : null,
            zona_cli ? parseInt(zona_cli) : null,
            direc_cli ? direc_cli.trim() : '',
            inf_adi_cli && inf_adi_cli.trim() !== '' ? inf_adi_cli.trim() : null,
            id_est ? parseInt(id_est) : null
        ]);

        // Respuesta exitosa
        return res.status(200).json({
            data: {
                code: 200,
                message: "CLIENTE_ACTUALIZADO_CON_EXITO"
            }
        });

    } catch (error) {
        // Si hay un error 45000 en BD se detecta porque intentan suspender sin un credito finalizado
        if (error.sqlState === '45000') {
            return res.status(400).json({
                data: { 
                    code: 400, 
                    message: "REQUISITO_CREDITO_NO_CUMPLIDO",
                    details: error.message 
                }
            });
        }

        console.error("Error crítico en actualizarCliente:", error.message || error);
        return res.status(500).json({
            data: { 
                code: 500, 
                message: "ERROR_SISTEMA_ACTUALIZACION" 
            }
        });
    }
};