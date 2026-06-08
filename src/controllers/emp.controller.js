import bcrypt from 'bcrypt';
import crypto from 'crypto';
import db from '../config/db.js';
import { enviarRespuesta } from '../utils/response.js';

const mapearMensajeBD = (msg) => {
    if (msg === 'usuario repetido') return 'USUARIO_REPETIDO';
    if (msg === 'email repetido') return 'EMAIL_REPETIDO';
    if (msg === 'DPI ya se encuentra registrado') return 'DPI_REPETIDO';
    if (msg === 'ID de empleado ya existe') return 'DPI_REPETIDO';
    
    return 'CATALOGO_INVALIDO'; 
};

export const registrarEmpleado = async (req, res) => {
    // Validaciones
    const rolCrudo = req.user && req.user.rol ? req.user.rol : '';
    const rolOperador = rolCrudo.trim().toLowerCase();

    console.log(`COMPROBANDO ACCESO -> Rol: '${rolOperador}'`);

    const rolesPermitidos = ['gerente', 'administrador', 'secretaria'];

    if (!rolesPermitidos.includes(rolOperador)) {
        return res.status(403).json(enviarRespuesta('ROL_NO_AUTORIZADO'));
    }

// Validacion de request
    const reglasValidacion = [
        { valor: req.body.name_emp, tipoEsperado: 'string' },
        { valor: req.body.ape_emp, tipoEsperado: 'string' },
        { valor: req.body.dpi_emp, tipoEsperado: 'string' },
        { valor: req.body.id_dep, tipoEsperado: 'number' },
        { valor: req.body.id_muni, tipoEsperado: 'number' },
        { valor: req.body.direc_cli, tipoEsperado: 'string' },
        { valor: req.body.tel_emp, tipoEsperado: 'string' },
        { valor: req.body.id_est, tipoEsperado: 'number' },
        { valor: req.body.id_rol, tipoEsperado: 'number' },
        { valor: req.body.name_us, tipoEsperado: 'string' },
        { valor: req.body.pass_us, tipoEsperado: 'string' }
    ];

    for (const campo of reglasValidacion) {
        if (campo.valor === null || campo.valor === undefined || (campo.tipoEsperado === 'string' && campo.valor.trim() === '')) {
            return res.status(400).json(enviarRespuesta('PARAMETROS_FALTANTES'));
        }

        if (typeof campo.valor !== campo.tipoEsperado) {
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS'));
        }
    }
    if (req.body.id_jefe !== null && req.body.id_jefe !== undefined) {
        if (typeof req.body.id_jefe !== 'string' || req.body.id_jefe.trim() === '') {
            return res.status(400).json(enviarRespuesta('PARAMETROS_INVALIDOS'));
        }
    }

        // Ejecucion en BD
    const { 
        id_jefe, name_emp, ape_emp, dpi_emp, email_emp, id_dep, 
        id_muni, direc_cli, tel_emp, id_est, id_rol, name_us, pass_us 
    } = req.body;

    try {
        //Ejecucion de sp de validacion
        const queryVal = `
            CALL sp_validar_datos_empleado(?, ?, ?, ?, ?, ?, ?, @cod, @men);
            SELECT @cod AS codigo, @men AS mensaje;
        `;
        const [rawResult] = await db.query(queryVal, [email_emp, name_us, dpi_emp, id_muni, id_dep, id_rol, id_est]);
        const validacion = rawResult[1][0];

        if (!validacion || validacion.codigo !== 1) {
            const claveError = validacion ? mapearMensajeBD(validacion.mensaje) : 'CATALOGO_INVALIDO';
            

            const estatusHTTP = (claveError.endsWith('_REPETIDO')) ? 409 : 400;
            return res.status(estatusHTTP).json(enviarRespuesta(claveError)); 
        }

        // Preparacion de id con ecnriptacion de 15 caracteres
        const id_emp = `EMP-${crypto.randomBytes(5).toString('hex').toUpperCase()}`; 
        const id_us  = `USU-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
        const securePassword = await bcrypt.hash(pass_us, 10);

        // Realiza transaccion
        const queryIns = `
            CALL sp_insertar_empleado_usuario(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @codIns, @menIns);
            SELECT @codIns AS codigo, @menIns AS mensaje;
        `;
        const [insertResult] = await db.query(queryIns, [
            id_emp, id_jefe, name_emp, ape_emp, dpi_emp, email_emp, id_dep, id_muni, 
            direc_cli, tel_emp, id_est, id_us, id_rol, name_us, securePassword
        ]);
        const insercion = insertResult[1][0];

        if (insercion && insercion.codigo === 1) {
            return res.status(201).json(enviarRespuesta('CREADO', { id_empleado: id_emp, id_usuario: id_us }));
        } else {
            return res.status(500).json(enviarRespuesta('ERROR_BASE_DATOS'));
        }

    } catch (error) {
        console.error("ERROR CRITICO DETECTADO EN EL CONTROLADOR DE EMPLEADOS:", error);
        return res.status(500).json(enviarRespuesta('ERROR_SERVIDOR'));
    }
};

export const obtenerInformacionEmpleados = async (req, res) => {
    const idUsOperador = req.user?.id_usuario;
    const rolOperador = req.user?.rol ? req.user.rol.trim().toLowerCase() : '';
    
    // id de empleado si se busca uno en especifico
    const { id_emp } = req.body;

    if (!idUsOperador || !rolOperador) {
        return res.status(401).json({
            data: { code: 401, message: "SESION_NO_VALIDA" }
        });
    }

    try {
        const filtroEmpLimpio = id_emp && id_emp.trim() !== '' ? id_emp.trim() : null;

        console.log(`REPORTE EMPLEADOS -> Operador: [${idUsOperador}] | Rol: [${rolOperador}] | Filtro Emp: [${filtroEmpLimpio || 'Todos'}]`);

        const queryCall = `CALL gestiones.sp_obtener_informacion_empleados(?, ?, ?)`;
        const [rows] = await db.query(queryCall, [
            idUsOperador,
            rolOperador,
            filtroEmpLimpio
        ]);

        const datosEmpleados = rows[0] || [];

        return res.status(200).json({
            data: {
                code: 200,
                message: "EMPLEADOS_PROCESADOS_CON_EXITO",
                count: datosEmpleados.length,
                empleados: datosEmpleados
            }
        });

    } catch (error) {
        console.error("Error en obtenerInformacionEmpleados:", error.message);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_SISTEMA_EXTRACCION" }
        });
    }
};