// RUTAS PRIVADAS
import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.routes.js';
import empRoutes from './src/routes/emp.routes.js';
import clienteRoutes from './src/routes/cliente.routes.js';
import usuarioRoutes from './src/routes/usuario.routes.js'; 
import creditoRoutes from './src/routes/credito.routes.js';
import abonoRoutes from './src/routes/abono.routes.js';
import rutasCatalogos from './src/routes/catalogos.routes.js';
import planPagosRoutes from './src/routes/planPagos.route.js'
import permisos from './src/routes/permisos.routes.js'

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/empleados', empRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/creditos', creditoRoutes);
app.use('/api/abonos', abonoRoutes);
app.use('/api/catalogos', rutasCatalogos);
app.use('/api/plan-pagos', planPagosRoutes);
app.use('/api/permisos', permisos);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ejecutandose en el puerto ${PORT}`));