// TODO LO RELACIONADO A CLIENTES
import crypto from 'crypto';
import db from '../config/db.js';
import { supabase } from '../config/supabase.js'
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

    console.log("DATOS DE TEXTO RECIBIDOS (req.body):", req.body);
    console.log("ARCHIVOS BINARIOS RECIBIDOS (req.files):", req.files);

    // Validacion de tipos 
    const id_dep = req.body.id_dep ? Number(req.body.id_dep) : undefined;
    const id_muni = req.body.id_muni ? Number(req.body.id_muni) : undefined;
    const zona_cli = req.body.zona_cli ? Number(req.body.zona_cli) : undefined;
    const id_est = req.body.id_est ? Number(req.body.id_est) : undefined;
    const latitud = req.body.latitud ? Number(req.body.latitud) : undefined;
    const longitud = req.body.longitud ? Number(req.body.longitud) : undefined;

    // Validacion de estrucura de datos
    const reglasValidacion = [
        { campo: 'name_cli', valor: req.body.name_cli, tipoEsperado: 'string' },
        { campo: 'ape_cli', valor: req.body.ape_cli, tipoEsperado: 'string' },
        { campo: 'dpi_cli', valor: req.body.dpi_cli, tipoEsperado: 'string' },
        { campo: 'tel_cli_1', valor: req.body.tel_cli_1, tipoEsperado: 'string' },
        { campo: 'ref_cli', valor: req.body.ref_cli, tipoEsperado: 'string' },
        { campo: 'tel_cli_ref', valor: req.body.tel_cli_ref, tipoEsperado: 'string' },
        { campo: 'emai_cli', valor: req.body.emai_cli, tipoEsperado: 'string' },
        { campo: 'direc_cli', valor: req.body.direc_cli, tipoEsperado: 'string' },
        { campo: 'id_dep', valor: id_dep, tipoEsperado: 'number' },
        { campo: 'id_muni', valor: id_muni, tipoEsperado: 'number' },
        { campo: 'zona_cli', valor: zona_cli, tipoEsperado: 'number' },
        { campo: 'id_est', valor: id_est, tipoEsperado: 'number' },
        // Campos para la ubicacion
        { campo: 'latitud', valor: latitud, tipoEsperado: 'number' },
        { campo: 'longitud', valor: longitud, tipoEsperado: 'number' }
    ];

    for (const regla of reglasValidacion) {
        if (regla.valor === null || regla.valor === undefined || (regla.tipoEsperado === 'string' && regla.valor.trim() === '')) {
            console.error(`VALIDACION FALLIDA: El parametro [${regla.campo}] falta o esta vacio.`);
            return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES'));
        }

        if (typeof regla.valor !== regla.tipoEsperado || (regla.tipoEsperado === 'number' && isNaN(regla.valor))) {
            console.error(`VALIDACION FALLIDA: El parametro [${regla.campo}] es invalido.`);
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS'));
        }
    }

    // Validacion de archivos de expediente
    if (!req.files || !req.files['foto_perfil'] || !req.files['foto_dpi'] || !req.files['foto_fachada']) {
        console.error("VALIDACIÓN FALLIDA: El expediente fotográfico está incompleto.");
        return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES'));
    }

    if (req.body.inf_adi_cli !== null && req.body.inf_adi_cli !== undefined) {
        if (typeof req.body.inf_adi_cli !== 'string') {
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS'));
        }
    }

    const { name_cli, ape_cli, dpi_cli, tel_cli_1, ref_cli, tel_cli_ref, emai_cli, direc_cli, inf_adi_cli } = req.body;

    const id_us_operador = req.user?.id_usuario || req.user?.id_us || req.user?.id;
    if (!id_us_operador) {
        console.error("ERROR DE AUDITORIA: No se encontro el ID del usuario en el token JWT.");
        return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES'));
    }

    // Variables que almacenan los path de imagenes
    let pathPerfil = '';
    let pathDpi = '';
    let pathFachada = '';

    try {
        // Se ejecuta sp para validaciones
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

        // Se genera el id del cliente
        const id_cli = `CLI-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

        // Se inicia la carga de imagenes en SUPABASE
        console.log(`Iniciando subida de expedientes a Supabase Storage para el cliente: ${id_cli}`);
        
        // Funcion para modularizar la subida de los buferes de memoria
        const subirArchivoABucket = async (fileObject, subcarpeta) => {
            const archivo = fileObject[0];
            const extension = archivo.originalname.split('.').pop() || 'jpg';
            // Estructura organizada por cliente y tipo: 'CLI-XXXXX/perfil_171852400.jpg'
            const rutaRelativa = `${id_cli}/${subcarpeta}_${Date.now()}.${extension}`;

            const { data, error } = await supabase.storage
                .from('expedientes-privados') // Nombre de bucket s3
                .upload(rutaRelativa, archivo.buffer, {
                    contentType: archivo.mimetype,
                    upsert: true
                });

            if (error) throw error;
            return rutaRelativa; // Se retorna la ruta para BD
        };

        // Ejecutamos las tres subidas en paralelo para optimizar tiempos
        const [resPerfil, resDpi, resFachada] = await Promise.all([
            subirArchivoABucket(req.files['foto_perfil'], 'perfil'),
            subirArchivoABucket(req.files['foto_dpi'], 'dpi'),
            subirArchivoABucket(req.files['foto_fachada'], 'fachada')
        ]);

        pathPerfil = resPerfil;
        pathDpi = resDpi;
        pathFachada = resFachada;

        console.log(`Archivos cargados exitosamente. Paths: Perfil[${pathPerfil}], DPI[${pathDpi}], Fachada[${pathFachada}]`);

        // Al haber subido todo correctamente procede a realizar la creacion del cliente en BD
        console.log(`Guardando cliente con ID: ${id_cli}`);
        const queryIns = `
            CALL sp_insertar_cliente(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @codIns, @menIns);
            SELECT @codIns AS codigo, @menIns AS mensaje;
        `;
        
        const [insertResult] = await db.query(queryIns, [
            id_cli, 
            id_us_operador, 
            null, // Despues se le asigna un jefe
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
            id_est,
            // Nuevos parametros 
            latitud,
            longitud,
            pathPerfil,
            pathDpi,
            pathFachada
        ]);
        
        const insercion = insertResult[1][0];

        if (insercion && insercion.codigo === 1) {
            return res.status(201).json(enviarRespuesta('CREADO', { id_cliente: id_cli }));
        } else {
            console.error("ERROR EN INSERCION BD, REVERTIR ARCHIVOS:", insercion);
            throw new Error('FALLO_INSERCION_MYSQL');
        }

    } catch (error) {
        console.error("ERROR CRITICO EN CONTROLADOR REGISTRAR_CLIENTE:", error);

        // Control en caso de que SUPABASE funciono correctamente pero mysql fallo
        // Se eliminan las imagenes de supabase para no almacenar imagenes huerfanas
        if (pathPerfil || pathDpi || pathFachada) {
            console.log("Limpiando archivos huerfanos de Supabase debido a fallo en transaccion");
            const archivosAEliminar = [pathPerfil, pathDpi, pathFachada].filter(Boolean);
            await supabase.storage.from('expedientes-privados').remove(archivosAEliminar);
        }

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
    const idUsuarioOperador = req.user?.id_usuario || req.user?.id_us || req.user?.id;
    const rolOperador = req.user?.rol ? req.user.rol.trim().toLowerCase() : '';
    const { id_jefe, id_asesor, estado_cliente } = req.query;

    if (!idUsuarioOperador || !rolOperador) {
        return res.status(401).json(enviarRespuesta('AUTENTICACION_REQUERIDA'));
    }

    try {
        const query = `CALL sp_obtener_informacion_clientes(?, ?, ?, ?, ?);`;
        const [rows] = await db.query(query, [
            idUsuarioOperador,
            rolOperador,
            id_jefe || null,
            id_asesor || null,
            estado_cliente || null
        ]);

        const resultadosRaw = rows[0];

        if (!resultadosRaw || resultadosRaw.length === 0) {
            return res.status(200).json(enviarRespuesta('EXITO', []));
        }

        // Firmar expedientes en paralelo y procesar los objetos de forma limpia
        const clientesProcesados = await Promise.all(resultadosRaw.map(async (row) => {
            const cliente = typeof row.cliente_json === 'string' 
                ? JSON.parse(row.cliente_json) 
                : row.cliente_json;

            const firmarImagenPrivada = async (pathInterno) => {
                if (!pathInterno || pathInterno === 'N/A') return null;
                try {
                    const { data, error } = await supabase.storage
                        .from('expedientes-privados')
                        .createSignedUrl(pathInterno, 900); // URL válida por 15 minutos
                    
                    if (error) return null;
                    return data.signedUrl;
                } catch (err) {
                    return null;
                }
            };

            const [urlPerfil, urlDpi, urlFachada] = await Promise.all([
                firmarImagenPrivada(cliente.path_foto_perfil),
                firmarImagenPrivada(cliente.path_foto_dpi),
                firmarImagenPrivada(cliente.path_foto_fachada)
            ]);

            cliente.url_foto_perfil = urlPerfil;
            cliente.url_foto_dpi = urlDpi;
            cliente.url_foto_fachada = urlFachada;
            
            delete cliente.path_foto_perfil;
            delete cliente.path_foto_dpi;
            delete cliente.path_foto_fachada;

            return cliente;
        }));

        return res.status(200).json(enviarRespuesta('EXITO', clientesProcesados));

    } catch (error) {
        console.error("❌ Error crítico en obtenerInformacionClientes:", error);
        return res.status(500).json(enviarRespuesta('ERROR_SERVIDOR'));
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