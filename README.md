# QR-Menu — Sistema de Menú Digital y Pedidos para Bar/Restaurante

Sistema web mobile-first para pedidos desde mesa mediante código QR con sincronización hacia comanda operativa de cocina (KDS) y panel de cobro en caja.

---

## 🚀 Guía de Puesta en Marcha Local

### 1. Requisitos Previos

- **Node.js**: Versión 20 o superior (verificado en Node.js v22)
- **npm**: Versión 10 o superior
- **PostgreSQL**: Opcional (el sistema soporta PGlite integrado con persistencia local en `.pgdata`, permitiendo arrancar inmediatamente sin instalar PostgreSQL ni Docker).

---

### 2. Instalación de Dependencias

Desde la raíz del repositorio, instala las dependencias de todos los workspaces:

```bash
npm install
```

---

### 3. Configuración de Variables de Entorno

Copia el archivo de plantilla `.env.example` a `.env`:

```bash
cp .env.example .env
```

Contenido estándar para desarrollo local:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Base de datos local PGlite (persistente en la carpeta .pgdata)
DATABASE_URL=pglite://.pgdata

# Clave secreta para cookies de sesión (mínimo 32 caracteres)
SESSION_SECRET=dev_super_secret_session_key_32_characters_minimum_local_testing

# Proxy y CORS
TRUST_PROXY=false
CORS_ORIGIN=http://localhost:5173

# Frontend (Vite)
VITE_API_BASE_URL=http://localhost:3000
```

> **Nota:** Si prefieres conectar un servidor PostgreSQL tradicional local o en la nube (Neon / Supabase), únicamente cambia `DATABASE_URL=postgresql://usuario:password@localhost:5432/nombre_db`.

---

### 4. Ejecutar Migraciones y Datos de Demostración

Aplica las migraciones de esquema a la base de datos:

```bash
npm run db:migrate
```

Inserta los datos iniciales de prueba (mesas, catálogo de productos y usuarios operativos):

```bash
npm run db:seed
```

---

### 5. Iniciar los Servicios

Abre dos terminales (o ejecuta en segundo plano):

#### Terminal 1 — Backend Fastify (Puerto 3000):
```bash
npm run dev:backend
```

#### Terminal 2 — Frontend Vite (Puerto 5173):
```bash
npm run dev:frontend
```

---

### 6. URLs del Sistema

| Módulo / Vista | URL | Descripción |
| :--- | :--- | :--- |
| **Frontend Público** | [http://localhost:5173](http://localhost:5173) | Inicio de la aplicación cliente |
| **Mesa 1 (QR)** | [http://localhost:5173/m/t_m1_7k9x2m](http://localhost:5173/m/t_m1_7k9x2m) | Menú y pedidos de la Mesa 1 |
| **Mesa 2 (QR)** | [http://localhost:5173/m/t_m2_4p8x1y](http://localhost:5173/m/t_m2_4p8x1y) | Menú y pedidos de la Mesa 2 |
| **Barra 1 (QR)** | [http://localhost:5173/m/t_b1_2l4n6p](http://localhost:5173/m/t_b1_2l4n6p) | Menú y pedidos de Barra 1 |
| **Login Personal** | [http://localhost:5173/login](http://localhost:5173/login) | Acceso para personal autorizado |
| **Panel Operaciones** | [http://localhost:5173/ops](http://localhost:5173/ops) | KDS de Cocina y Cobro en Caja |
| **Backend API** | [http://localhost:3000](http://localhost:3000) | Servidor API REST Fastify |
| **Health Check** | [http://localhost:3000/healthz](http://localhost:3000/healthz) | Estado de salud del backend |

---

### 7. Credenciales de Desarrollo (SOLO LOCAL)

> ⚠️ **Advertencia de Seguridad:** Estas credenciales son exclusivas para pruebas en desarrollo local. El comando de seed está bloqueado en producción (`NODE_ENV=production`).

| Rol | Usuario | Contraseña | Permisos Operativos |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin` | `Admin123!` | Acceso completo (KDS, Cobro, Auditoría) |
| **CAJERO (CASHIER)** | `caja` | `Admin123!` | Visualizar comandas y confirmar pagos (`UNPAID` → `PAID`) |
| **COCINERO (KITCHEN)** | `cocina` | `Admin123!` | Avanzar preparación (`PENDING` → `PREPARING` → `DELIVERED`) |

---

### 8. Cómo Detener los Servicios

Presiona `Ctrl + C` en cada una de las terminales donde se estén ejecutando `npm run dev:backend` y `npm run dev:frontend`.

Si los procesos quedaron ejecutándose en segundo plano, puedes detenerlos buscando sus puertos:

```bash
# Detener backend en puerto 3000
kill $(lsof -t -i:3000)

# Detener frontend en puerto 5173
kill $(lsof -t -i:5173)
```

---

### 9. Pruebas Automáticas y Verificación de Calidad

Para comprobar la integridad total del monorepo:

```bash
# Ejecutar los 100 tests unitarios y de integración
npm test

# Verificación de tipos TypeScript
npm run typecheck

# Compilación de producción
npm run build
```
