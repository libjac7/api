import bcrypt from 'bcrypt';
import crypto from 'crypto';
import db from '../config/db.js';
import { enviarRespuesta } from '../utils/response.js';

const mapearMensajeBD = (msg) => {
    if (msg === 'usuario repetido') return 'USUARIO_REPETIDO';
    if (msg === 'email repetido') return 'EMAIL_REPETIDO';
    if (msg === 'DPI ya se encuentra registrado') return 'DPI_REPETIDO';
    if (msg === 'ID de empleado ya existe') return 'DPI_REPETIDO';
    if (msg === 'EMPLEADO_NO_EXISTE') return 'EMPLEADO_NO_EXISTE';
    if (msg === 'UBICACION_INCONSISTENTE') return 'UBICACION_INCONSISTENTE';
    if (msg === 'ESTADO_INVALIDO') return 'ESTADO_INVALIDO';
    if (msg === 'OPERADOR_INVALIDO_O_SUSPENDIDO') return 'OPERADOR_INVALIDO_O_SUSPENDIDO';
    
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

export const asignarJefeAEmpleado = async (req, res) => {

    const idUsOperador = req.user?.id_usuario;
    const rolOperador = req.user?.rol ? req.user.rol.toLowerCase().trim() : '';

    const { id_emp, id_jefe } = req.body;

    const rolesPermitidos = ['administrador', 'gerente', 'secretaria'];
    
    if (!rolesPermitidos.includes(rolOperador)) {
        console.warn(`🛑 ACCESO RECHAZADO: El usuario [${idUsOperador}] con rol [${rolOperador}] intentó asignar una jerarquía sin permisos.`);
        return res.status(403).json({
            data: { 
                code: 403, 
                message: "ACCESO_DENEGADO_ROL_INSUBIDICADO" 
            }
        });
    }

    if (!id_emp || id_emp.trim() === '') {
        return res.status(400).json({
            data: { code: 400, message: "ID_EMPLEADO_REQUERIDO" }
        });
    }

    try {
        console.log(`💼 OPERADOR: [${idUsOperador}] (${rolOperador.toUpperCase()}) asignando jefe [${id_jefe}] al empleado [${id_emp}]`);

        const queryCompleta = `
            SET @codigo = 0, @mensaje = '';
            CALL sp_asignar_jefe_empleado(?, ?, @codigo, @mensaje);
            SELECT @codigo AS codigo, @mensaje AS mensaje;
        `;

        const [results] = await db.query(queryCompleta, [
            id_emp.trim(), 
            id_jefe && id_jefe.trim() !== '' ? id_jefe.trim() : null
        ]);

        const resultVars = results.find(element => Array.isArray(element) && element[0] && 'codigo' in element[0]);
        
        if (!resultVars || resultVars.length === 0) {
            throw new Error("No se pudieron recuperar las variables de salida del procedimiento almacenado.");
        }

        const { codigo, mensaje } = resultVars[0];

        if (codigo === 1) {
            console.log(`EITO: Jerarquia asignada correctamente.`);
            return res.status(200).json({
                data: {
                    code: 200,
                    message: mensaje
                }
            });
        } else {
            console.warn(`RECHAZADO POR REGLA DE BASE DE DATOS: ${mensaje}`);
            return res.status(400).json({
                data: {
                    code: 400,
                    message: mensaje
                }
            });
        }

    } catch (error) {
        console.error("ERROR CRITICO EN ASIGNAR_JEFE_EMPLEADO:", error.message || error);
        return res.status(500).json({
            data: {
                code: 500,
                message: "ERROR_INTERNO_SERVIDOR_RENDER"
            }
        });
    }
};

export const actualizarEmpleado = async (req, res) => {
    // 1. Identidad del operador extraída del Token JWT
    const idUsOperador = req.user?.id_usuario || req.user?.id;
    const rolCrudo = req.user && req.user.rol ? req.user.rol : '';
    const rolOperador = rolCrudo.trim().toLowerCase();
    
    const permisosAdicionales = (req.user?.permisos || []).map(p => p.trim().toLowerCase());
    const permisosDenegados = (req.user?.denegar || []).map(p => p.trim().toLowerCase());

    console.log(`INTENTO DE ACTUALIZACIÓN -> Operador: [${idUsOperador}] | Rol: '${rolOperador}'`);

    // 2. Capa de Seguridad Jerárquica Híbrida
    const esAdmin = rolOperador === 'administrador';
    const tieneRolAncestral = ['gerente', 'secretaria'].includes(rolOperador);
    const tienePermisoConcedido = permisosAdicionales.includes('actualizar_empleados');
    const tienePermisoDenegado = permisosDenegados.includes('actualizar_empleados'); 

    let accesoConcedido = false;

    if (esAdmin) {
        accesoConcedido = true; 
    } else if (tienePermisoDenegado) {
        accesoConcedido = false; 
    } else if (tieneRolAncestral || tienePermisoConcedido) {
        accesoConcedido = true; 
    }

    if (!accesoConcedido) {
        console.warn(`ACCESO RECHAZADO -> El operador [${idUsOperador}] no cuenta con los privilegios requeridos.`);
        return res.status(403).json({ data: { code: 403, message: 'ROL_NO_AUTORIZADO' } });
    }

    // 3. Extracción del ID del empleado de los parámetros de la URL
    const { id } = req.params; 
    if (!id || id === 'null' || id === 'undefined' || id.trim() === '') {
        return res.status(400).json({ data: { code: 400, message: 'PARAMETROS_INVALIDOS' } });
    }

    // 4. Forzamos el casteo numérico estricto desde req.body (Soluciona el ReferenceError)
    const id_dep = req.body.id_dep !== undefined ? Number(req.body.id_dep) : undefined;
    const id_muni = req.body.id_muni !== undefined ? Number(req.body.id_muni) : undefined;
    const id_est = req.body.id_est !== undefined ? Number(req.body.id_est) : undefined;
    const id_rol = req.body.id_rol !== undefined ? Number(req.body.id_rol) : undefined;

    // Validación de tipos del Body usando los números ya casteados
    const reglasValidacion = [
        { valor: req.body.name_emp, tipoEsperado: 'string' },
        { valor: req.body.ape_emp, tipoEsperado: 'string' },
        { valor: req.body.dpi_emp, tipoEsperado: 'string' },
        { valor: id_dep, tipoEsperado: 'number' },
        { valor: id_muni, tipoEsperado: 'number' },
        { valor: req.body.direc_cli, tipoEsperado: 'string' },
        { valor: req.body.tel_emp, tipoEsperado: 'string' },
        { valor: id_est, tipoEsperado: 'number' },
        { valor: id_rol, tipoEsperado: 'number' }
    ];

    for (const campo of reglasValidacion) {
        if (campo.valor === null || campo.valor === undefined || (campo.tipoEsperado === 'string' && String(campo.valor).trim() === '')) {
            return res.status(400).json({ data: { code: 400, message: 'PARAMETROS_FALTANTES' } });
        }
        if (typeof campo.valor !== campo.tipoEsperado || (campo.tipoEsperado === 'number' && isNaN(campo.valor))) {
            return res.status(400).json({ data: { code: 400, message: 'PARAMETROS_INVALIDOS' } });
        }
    }

    // 5. Extracción y Limpieza segura de los strings del Body
    const id_jefe = (req.body.id_jefe && String(req.body.id_jefe).toLowerCase() !== 'no asignado' && String(req.body.id_jefe).trim() !== '') 
        ? String(req.body.id_jefe).trim() 
        : null;

    const name_emp = req.body.name_emp.trim();
    const ape_emp = req.body.ape_emp.trim();
    const dpi_emp = req.body.dpi_emp.trim();
    const email_emp = (req.body.email_emp && req.body.email_emp.trim() !== '') ? req.body.email_emp.trim() : null;
    const direc_cli = req.body.direc_cli.trim();
    const tel_emp = req.body.tel_emp.trim();

    try {
        console.log(`💾 Procesando SPs en BD para el empleado: [${id}]...`);

        // 6. SP de Validación Cruzada (Orden de posición estricto mapeado para MySQL)
        const queryVal = `
            CALL sp_validar_datos_actualizar_empleado(?, ?, ?, ?, ?, ?, ?, ?, @cod, @men);
            SELECT @cod AS codigo, @men AS mensaje;
        `;
        
        const [rawResult] = await db.query(queryVal, [
            id,          // 1. p_id_emp
            email_emp,   // 2. p_email_emp
            dpi_emp,     // 3. p_dpi_emp
            id_muni,     // 4. p_id_muni 👈 Definida correctamente arriba
            id_dep,      // 5. p_id_dep  👈 Definida correctamente arriba
            id_rol,      // 6. p_id_rol
            id_est,      // 7. p_id_est
            idUsOperador // 8. p_us_act
        ]);
        
        const validacion = rawResult[1][0];

        if (!validacion || validacion.codigo !== 1) {
            const claveError = validacion ? mapearMensajeBD(validacion.mensaje) : 'DATOS_INVALIDOS';
            const estatusHTTP = (claveError.endsWith('_REPETIDO')) ? 409 : 400;
            
            console.log(`❌ Validación rechazada por la BD: ${validacion?.mensaje || 'Desconocido'}`);
            return res.status(estatusHTTP).json({
                data: { code: estatusHTTP, message: claveError }
            }); 
        }

        // 7. SP de Actualización Física Cohesiva
        const queryUpd = `
            CALL sp_actualizar_empleado_usuario(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @codUpd, @menUpd);
        `;
        
        const [updateResult] = await db.query(queryUpd, [
            id,           // 1. p_id_emp
            id_jefe,      // 2. p_id_jefe
            name_emp,     // 3. p_name_emp
            ape_emp,      // 4. p_ape_emp
            dpi_emp,      // 5. p_dpi_emp
            email_emp,    // 6. p_email_emp
            id_dep,       // 7. p_id_dep
            id_muni,      // 8. p_id_muni
            direc_cli,    // 9. p_direc_cli
            tel_emp,      // 10. p_tel_emp
            id_est,       // 11. p_id_est
            id_rol,       // 12. p_id_rol
            idUsOperador  // 13. p_us_act
        ]);

        const infoAfectada = updateResult && updateResult[0] && updateResult[0][0] ? updateResult[0][0] : {};

        console.log(`✅ Empleado [${id}] actualizado exitosamente.`);
        
        // Retorno Detallado Exitoso
        return res.status(200).json({
            data: {
                code: 200,
                message: "ACTUALIZADO_CON_EXITO",
                colaborador: {
                    nombre: infoAfectada.name_emp || name_emp,
                    apellido: infoAfectada.ape_emp || ape_emp,
                    estado_actual: infoAfectada.name_est || "Activo"
                }
            }
        });

    } catch (error) {
        console.error("ERROR CRITICO EN EL CONTROLADOR DE ACTUALIZACION DE EMPLEADOS:", error);
        return res.status(500).json({
            data: { code: 500, message: 'ERROR_SERVIDOR' }
        });
    }
};