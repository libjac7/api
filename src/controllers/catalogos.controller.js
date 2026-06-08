
import db from '../config/db.js';

// Catalogo de Estados
export const obtenerEstados = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id_est, name_est, aplica_a, descrip_est FROM estados ORDER BY aplica_a ASC, name_est ASC'
        );
        return res.status(200).json({
            data: {
                code: 200,
                message: "CATALOGO_ESTADOS_PROCESADO_CON_EXITO",
                count: rows.length,
                estados: rows
            }
        });
    } catch (error) {
        console.error("Error en obtenerEstados:", error.message);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_INTERNO_SERVIDOR" }
        });
    }
};

// Catalogo de Roles
export const obtenerRoles = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id_rol, name_rol FROM roles ORDER BY name_rol ASC');
        return res.status(200).json({
            data: {
                code: 200,
                message: "CATALOGO_ROLES_PROCESADO_CON_EXITO",
                count: rows.length,
                roles: rows
            }
        });
    } catch (error) {
        console.error("Error en obtenerRoles:", error.message);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_INTERNO_SERVIDOR" }
        });
    }
};

// Catalogo de Departamentos
export const obtenerDepartamentos = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id_dep, name_dep FROM departamentos ORDER BY name_dep ASC');
        return res.status(200).json({
            data: {
                code: 200,
                message: "CATALOGO_DEPARTAMENTOS_PROCESADO_CON_EXITO",
                count: rows.length,
                departamentos: rows
            }
        });
    } catch (error) {
        console.error("Error en obtenerDepartamentos:", error.message);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_INTERNO_SERVIDOR" }
        });
    }
};

// Catalogo de municipios por departamento
export const obtenerMunicipiosPorDepartamento = async (req, res) => {
    const { id_dep } = req.params;

    if (!id_dep) {
        return res.status(400).json({
            data: { code: 400, message: "DEPARTAMENTO_REQUERIDO" }
        });
    }

    try {
        const [rows] = await db.query(
            'SELECT id_muni, id_dep, name_mun FROM municipios WHERE id_dep = ? ORDER BY name_mun ASC',
            [id_dep]
        );
        return res.status(200).json({
            data: {
                code: 200,
                message: "CATALOGO_MUNICIPIOS_PROCESADO_CON_EXITO",
                count: rows.length,
                municipios: rows
            }
        });
    } catch (error) {
        console.error("Error en obtenerMunicipiosPorDepartamento:", error.message);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_INTERNO_SERVIDOR" }
        });
    }
};

// 5. Catalogo de Planes de Financiamiento
export const obtenerPlanesFinanciamiento = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.id_finan, 
                p.name_finan, 
                p.tasa_int_finan, 
                p.tipo_per_finan, 
                p.tasa_mora, 
                p.id_est,
                COALESCE(e.name_est, 'N/A') AS estado_plan
            FROM planes_financiamiento p
            LEFT JOIN estados e ON p.id_est = e.id_est
            ORDER BY p.name_finan ASC
        `);
        return res.status(200).json({
            data: {
                code: 200,
                message: "CATALOGO_PLANES_PROCESADO_CON_EXITO",
                count: rows.length,
                planes: rows
            }
        });
    } catch (error) {
        console.error("Error en obtenerPlanesFinanciamiento:", error.message);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_INTERNO_SERVIDOR" }
        });
    }
};