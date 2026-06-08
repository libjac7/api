import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true // para ejecutar CALL y SELECT paralelos
});

// Verificar conexión
(async () => {
    try {
        const connection = await db.getConnection();

        console.log('✅ Conexión exitosa a la base de datos');
        connection.release();
    } catch (error) {
        console.error('❌ Error al conectar a la base de datos');
        console.error(error.message);
    }
})();


export default db;