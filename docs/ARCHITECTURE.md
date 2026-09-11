# Documentación de Arquitectura y API Pública - QR Menu

## Estructura del Monorepo

```text
/
├── apps/
│   ├── backend/               # API Fastify 5 + TypeScript + PostgreSQL
│   └── frontend/              # Web App Móvil Vue 3 + Vite + Pinia
├── packages/
│   └── shared/                # Tipos, Enums y Esquemas de validación Zod
├── docs/                      # Documentación técnica y bitácora
├── .env.example               # Plantilla de variables de entorno (sin secretos)
├── .gitignore                 # Exclusiones de control de versiones
├── package.json               # Configuración de workspaces npm
└── tsconfig.base.json         # Configuración base estricta de TypeScript
```

---

## Principios de Seguridad y Dominio

1. **Zero-Trust Client (Soberanía del Servidor):**
   * El cliente **nunca** envía precios, subtotales ni totales.
   * El backend consulta los productos en PostgreSQL, valida que existan y que `is_available = true`, y realiza el cálculo de subtotales y total con aritmética decimal de centavos exacta para evitar errores de precisión de punto flotante.
   * Si un cliente intenta enviar `price: 1` o campos monetarios en DevTools, el backend los ignora por completo.
2. **Snapshots Históricos Inmutables:**
   * En `order_items` se congelan `product_name_snapshot` y `unit_price_snapshot`. Si el producto cambia de precio o nombre en el futuro, los pedidos históricos permanecen inalterados.
3. **Idempotencia Transaccional (`X-Idempotency-Key`):**
   * Es obligatorio el encabezado `X-Idempotency-Key` (entre 6 y 64 caracteres) en `POST /api/orders`.
   * Se calcula un hash SHA-256 canónico del payload normalizado (`tableToken`, `paymentMethodDeclared`, `notes`, `items` ordenados por `productId`).
   * **Misma clave + Mismo hash:** Retorna la orden previamente creada sin duplicarla.
   * **Misma clave + Distinto hash:** Rechaza con código `409 Conflict` (`IDEMPOTENCY_KEY_REUSED`).
   * **Concurrencia:** La restricción `UNIQUE (idempotency_key)` en PostgreSQL asegura que 10 peticiones simultáneas solo creen una única orden en base de datos.
4. **No Enumeración de Pedidos:**
   * Las órdenes se consultan públicamente mediante `public_code` (`ORD-` + 6 caracteres alfanuméricos unguessable, ej: `ORD-K7M2P9`).
   * No existen endpoints públicos que acepten IDs secuenciales (`/orders/1`, `/orders/2`).

---

## Contratos de la API Pública

### 1. `GET /api/menu`
Retorna el catálogo público activo ordenado por `categories.sort_order` y `products.sort_order`. Excluye categorías inactivas y productos agotados.

* **Headers:** `If-None-Match` (opcional).
* **Respuesta (200 OK):**
  ```json
  {
    "categories": [
      {
        "id": 1,
        "name": "Cervezas",
        "icon": "beer",
        "sortOrder": 1,
        "products": [
          {
            "id": 1,
            "name": "Pilsen 330ml",
            "description": "Lata bien fría",
            "price": 5000,
            "imageUrl": null,
            "sortOrder": 1
          }
        ]
      }
    ]
  }
  ```
* **Respuesta con Caché (304 Not Modified):** Si el `If-None-Match` coincide con el `ETag` generado por el servidor.

---

### 2. `POST /api/orders`
Crea una nueva orden de forma atómica dentro de una transacción PostgreSQL.

* **Headers Obligatorios:**
  * `X-Idempotency-Key`: Cadena única UUID o alfanumérica (6-64 chars).
  * `Content-Type`: `application/json`.
* **Payload:**
  ```json
  {
    "tableToken": "t_m1_7k9x2m",
    "paymentMethodDeclared": "CASH",
    "notes": "Sin hielo",
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ]
  }
  ```
* **Respuesta Exitosa (201 Created):**
  ```json
  {
    "orderCode": "ORD-K7M2P9",
    "orderNumber": 1,
    "tableName": "Mesa 1",
    "totalAmount": 10000,
    "fulfillmentStatus": "PENDING",
    "paymentStatus": "UNPAID",
    "createdAt": "2026-09-10T15:20:00.000Z"
  }
  ```
* **Respuestas de Error:**
  * `400 Bad Request` (`IDEMPOTENCY_KEY_MISSING` / `VALIDATION_ERROR` / `PRODUCT_NOT_FOUND`)
  * `404 Not Found` (`INVALID_TABLE_TOKEN`)
  * `409 Conflict` (`PRODUCT_UNAVAILABLE` / `IDEMPOTENCY_KEY_REUSED`)

---

### 3. `GET /api/orders/:publicCode/status`
Consulta pública y segura del estado de un pedido sin exponer UUIDs internos ni datos administrativos.

* **Parámetro de Ruta:** `publicCode` (ej: `ORD-K7M2P9`).
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "orderCode": "ORD-K7M2P9",
    "orderNumber": 1,
    "tableName": "Mesa 1",
    "fulfillmentStatus": "PENDING",
    "paymentStatus": "UNPAID",
    "totalAmount": 10000,
    "createdAt": "2026-09-10T15:20:00.000Z"
  }
  ```
* **Error (404 Not Found):**
  ```json
  {
    "error": {
      "code": "ORDER_NOT_FOUND",
      "message": "No se encontró ningún pedido con el código 'ORD-K7M2P9'",
      "statusCode": 404,
      "timestamp": "2026-09-10T15:20:00.000Z"
    }
  }
  ```

---

## Formato Centralizado de Errores

Todos los errores siguen la estructura estandarizada:
```json
{
  "error": {
    "code": "PRODUCT_UNAVAILABLE",
    "message": "El producto 'Cerveza Águila' no se encuentra disponible en este momento",
    "statusCode": 409,
    "details": { "productId": 2, "productName": "Cerveza Águila" },
    "timestamp": "2026-09-10T15:20:00.000Z"
  }
}
```

---

## FASE 3: Arquitectura Frontend Público QR / Experiencia del Cliente

### 1. Flujo de Usuario
```text
Escaneo de QR en mesa
       ↓
/m/:tableToken (Catálogo dinámico, navegación horizontal por categorías, bottom bar con contador)
       ↓
Selección de productos (+ / - / eliminar)
       ↓
/m/:tableToken/cart (Revisión de ítems, notas con límite de 150 chars, método de pago declarado)
       ↓
POST /api/orders (Encabezado X-Idempotency-Key con UUID único, botón bloqueado contra doble click)
       ↓
/m/:tableToken/confirmation/:orderCode (Confirmación visual, stepper de progreso, polling cada 5s)
       ↓
Estados: PENDING → PREPARING → DELIVERED (Parada automática de polling y liberación de recursos)
```

### 2. Rutas Frontend
* `/m/:tableToken`: Menú público asociado a la mesa. Bloquea la selección manual o arbitraria de mesas.
* `/m/:tableToken/cart`: Pantalla de carrito, notas, método de pago declarado y confirmación.
* `/m/:tableToken/confirmation/:orderCode`: Pantalla de seguimiento en tiempo real del pedido.

### 3. Principio de Soberanía en Frontend
* El estado del carrito calcula un **Total Estimado** exclusivamente para previsualización UX.
* El payload enviado a la API contiene únicamente `{ tableToken, paymentMethodDeclared, notes, items: [{ productId, quantity }] }`.
* El frontend **nunca** calcula ni envía precios unitarios, subtotales ni total final al crear la orden.
* El estado de pago en confirmación respeta el valor `UNPAID` o `PAID` devuelto por el servidor; jamás se asume como `PAID` por el simple hecho de seleccionar un método de pago.

### 4. Idempotencia y Resiliencia ante Red
* Cada ciclo de orden genera una clave única con `crypto.randomUUID()`.
* En caso de reintento por error de red o timeout, la clave se preserva para evitar pedidos duplicados en el servidor.
* Una vez el pedido se crea con éxito, el carrito genera una nueva clave de idempotencia para la siguiente orden.

### 5. Polling Inteligente de Estado
* Consulta periódica cada 5000 ms a `GET /api/orders/:orderCode/status`.
* Se detiene automáticamente cuando el pedido alcanza `DELIVERED` o `CANCELLED`.
* Se destruye (`clearInterval`) de forma garantizada cuando el usuario desmonta o navega fuera del componente (`onUnmounted`).

### 6. Manejo de Errores y Conflicto (409 Conflict)
* Si el servidor responde con `409 Conflict` (producto agotado o precio modificado en servidor), se presenta un mensaje claro y amigable al usuario invitándole a revisar su carrito, sin borrar la selección ni ejecutar operaciones silenciosas.

---

## FASE 4: Arquitectura de Operaciones, Autenticación y KDS

### 1. Modelo de Seguridad y Autenticación Server-Side
* **Sin almacenamiento vulnerable:** Cero tokens o credenciales en `localStorage` o `sessionStorage`.
* **Sesiones Server-Side:** Token criptográfico opaco de 64 bytes hex almacenado en la tabla `sessions` en PostgreSQL, vinculado al `user_id`, con TTL de 24 horas.
* **Cookies HttpOnly firmadas:** La sesión viaja exclusivamente a través de la cookie firmada `qr_session` (`HttpOnly: true`, `SameSite: Lax`, `Secure: producción`, `Path: /`).
* **Password Hashing:** Algoritmo Argon2id con sal aleatoria por usuario.
* **Protección contra Fuerza Bruta y Timing Attacks:**
  * Rate-limit estricto en `POST /api/auth/login` (máximo 5 peticiones por minuto por IP).
  * Mensaje de error único (*"Usuario o contraseña incorrectos"*), sin revelar si el usuario existe o no.
  * Cómputo simulado de hash en caso de usuario inexistente para homogeneizar el tiempo de respuesta.

### 2. Matriz de Roles y Autorización (RBAC)

| Acción Operativa | ADMIN | CASHIER | KITCHEN | Código si denegado |
|---|:---:|:---:|:---:|:---:|
| Ver pedidos (`GET /api/ops/orders`) | Sí | Sí | Sí | `403 FORBIDDEN` |
| Ver detalle comanda (`GET /api/ops/orders/:id`) | Sí | Sí | Sí | `403 FORBIDDEN` |
| Iniciar preparación (`PREPARING`) | Sí | No | Sí | `403 FORBIDDEN` |
| Marcar entregado (`DELIVERED`) | Sí | No | Sí | `403 FORBIDDEN` |
| Cancelar pedido (`CANCELLED`) | Sí | Sí (en caja) | Sí (en cocina) | `403 FORBIDDEN` |
| Confirmar cobro (`PAID`) | Sí | Sí | **No** | `403 FORBIDDEN` |
| Administrar accesos y usuarios | Sí | No | No | `403 FORBIDDEN` |

### 3. Máquina de Estados de Pedidos y Concurrencia
* **Transiciones válidas:**
  * `PENDING -> PREPARING`
  * `PENDING -> CANCELLED`
  * `PREPARING -> DELIVERED`
  * `PREPARING -> CANCELLED`
  * Estados `DELIVERED` y `CANCELLED` son **terminales** e inmutables.
* **Actualizaciones Condicionales Atómicas:**
  Todas las mutaciones de comanda y cobro se ejecutan condicionalmente en SQL (`WHERE id = $id AND fulfillment_status = $expectedStatus`).
* **Manejo de Concurrencia:**
  Si dos operadores intentan tomar o cobrar la misma orden simultáneamente, exactamente uno tiene éxito (`200 OK`) y el segundo recibe `409 Conflict` (`ORDER_STATE_CONFLICT` / `ORDER_ALREADY_PAID`), activando el refresco automático de la UI.
* **Soberanía del Pago:**
  `paymentMethodDeclared` registra la intención del cliente; únicamente el cajero o admin puede transicionar `payment_status` de `UNPAID` a `PAID`. No existe reversión accidental `PAID -> UNPAID`.

### 4. Protección CSRF
* Validación de encabezados `Origin` y `Referer` contra `CORS_ORIGIN`.
* Requerimiento obligatorio de encabezado no simple `X-Requested-With: XMLHttpRequest` o `Content-Type: application/json` en todas las mutaciones para forzar el preflight CORS en navegadores.

### 5. Auditoría Inmutable (`audit_logs`)
Toda acción operativa sensible (`USER_LOGIN`, `ORDER_FULFILLMENT_UPDATED`, `ORDER_PAYMENT_CONFIRMED`) genera un registro histórico que documenta:
* `userId`: Quién ejecutó la acción.
* `action`: Qué acción se realizó.
* `entityType` y `entityId`: Sobre qué recurso.
* `metadata`: Detalles contextuales (estado previo, nuevo estado, motivo). Sanitizado estrictamente para garantizar que **nunca** contenga contraseñas, hashes ni cookies.
* `ipAddress`: Dirección IP del operador.

### 6. Contratos de la API Privada
* `POST /api/auth/login`: `{ username, password }` -> 200 OK + Set-Cookie `qr_session`.
* `POST /api/auth/logout`: Invalida sesión en DB y destruye cookie.
* `GET /api/auth/me`: Retorna `{ user: { id, username, role } }`.
* `GET /api/ops/orders`: Query params opcionales: `fulfillmentStatus`, `paymentStatus`, `tableId`.
* `GET /api/ops/orders/:orderId`: Detalle comanda con productos y cantidades.
* `PATCH /api/ops/orders/:orderId/fulfillment`: `{ status, reason? }`.
* `PATCH /api/ops/orders/:orderId/payment`: `{ paymentStatus: 'PAID' }`.


