# PillSync IoT - Aplicación Web para Dispensador Inteligente de Pastillas

Aplicación frontend moderna y reactiva desarrollada con **React 18**, **TypeScript**, **Vite**, **Tailwind CSS** y **@supabase/supabase-js** para la supervisión y control de un dispensador físico de medicamentos IoT.

---

## 🛠️ Tecnologías y Librerías

- **Frontend Core**: React 18, TypeScript, Vite
- **Estilos y UI**: Tailwind CSS, animaciones personalizadas, microinteracciones, Google Fonts (*Plus Jakarta Sans*)
- **Iconografía**: `lucide-react`
- **Backend as a Service**: `@supabase/supabase-js` (Auth, Postgres DB, Row Level Security, Realtime WebSockets)
- **Modo Demo / Fallback**: Soporte automático con persistencia local si no se configuran variables de entorno de Supabase al inicio.

---

## 🗄️ Esquema de Base de Datos en Supabase (4 Tablas)

La aplicación interactúa directamente con las 4 tablas especificadas:

1. **`cuidadores`**:
   - `id` (UUID vinculado a `auth.users.id`)
   - `email` (correo del cuidador)
   - `nombre` (nombre completo)
   - `telefono` (teléfono de contacto)
2. **`dispositivos`**:
   - `id` (UUID)
   - `mac_id` (Identificador MAC único transmitido por el microcontrolador ESP32)
   - `cuidador_id` (UUID de cuidador asignado)
   - `pastillas_restantes` (conteo numérico en tiempo real del stock de píldoras)
   - `nombre` (etiqueta personalizada: e.g. "Dispensador Sala")
   - `estado` (`online` | `offline`)
   - `capacidad_maxima`
3. **`horarios`**:
   - `id` (UUID)
   - `dispositivo_id` / `mac_id`
   - `hora_programada` (TIME, e.g. "08:00")
   - `estado` (`activo` | `inactivo`)
   - `medicamento`, `dosis`, `dias`, `notas`
4. **`historial_tomas`**:
   - `id` (UUID)
   - `dispositivo_id` / `mac_id`
   - `evento` (`dispensado` | `atasco` | `tapa_abierta`)
   - `created_at` (Timestamp)
   - `detalles` (diagnóstico o descripción de la toma)

> Nota: El archivo [`supabase_schema.sql`](./supabase_schema.sql) contiene el script SQL listo para ejecutar en el SQL Editor de Supabase (tablas, RLS y canales realtime).

---

## 🖥️ Vistas Principales Desarrolladas

### 1. Vista de Login / Registro
- Autenticación completa mediante **Supabase Auth** (`signInWithPassword` y `signUp`).
- Pestañas intercambiables entre Inicio de Sesión y Registro con validación en tiempo real.
- Vinculación automática del usuario a la tabla `cuidadores`.
- Botón **"Acceso Rápido Demo"** para evaluación instantánea en 1 clic.

### 2. Vista de Onboarding
- Formulario de vinculación donde el cuidador ingresa el `mac_id` de su dispensador físico.
- Formateo y validación de dirección MAC (ej. `24:6F:28:B2:8E:44`).
- Asignación de nombre amigable y carga inicial de `pastillas_restantes`.
- Botón de generación de MAC de prueba y guía visual de localización del identificador en el hardware.
- Persistencia e inserción/actualización directa en la tabla `dispositivos`.

### 3. Vista de Dashboard
- **Panel Superior**:
  - Estado de conexión en vivo (`online` / `offline` con indicador pulsante).
  - MAC ID con botón de copiado rápido al portapapeles.
  - Indicador radial / barra de progreso de `pastillas_restantes`.
  - **Alertas condicionales automáticas**: Alerta roja parpadeante de nivel crítico si el inventario es $\le 5$ pastillas.
  - Modal **"Recargar Pastillero"** para reponer comprimidos (+5, +10, +20, o 30 pastillas).
- **Sección CRUD de Horarios (`horarios`)**:
  - **Crear**: Modal interactivo para configurar hora, medicamento, dosis, días de la semana y notas.
  - **Leer**: Tarjetas visuales de cada horario con selector AM/PM y chips de días activos.
  - **Actualizar**: Switch rápido para alternar `estado` entre `activo` e `inactivo`, y modal de edición.
  - **Eliminar**: Botón de eliminación con confirmación de seguridad para prevenir borrados accidentales.
- **Tabla Histórica (`historial_tomas`)**:
  - **Diseño condicional estricto**:
    - 🟢 **Verde** para eventos exitosos (`dispensado`): Badge esmeralda con check, fondo sutil y confirmación de sensor infrarrojo.
    - 🔴 **Rojo** para anomalías e incidentes (`atasco` o `tapa_abierta`): Alerta carmesí/ámbar con ícono de advertencia y diagnóstico técnico.
  - Filtros rápidos: "Todos", "Solo Exitosos", "Incidentes / Alertas".
  - Barra de búsqueda de eventos o medicamentos en tiempo real.
  - **Simulador de Eventos IoT integrado**: Barra superior interactiva para disparar eventos de hardware en vivo (`+ Dispensado`, `+ Atasco`, `+ Tapa Abierta`) y verificar la respuesta reactiva inmediata de la interfaz.

---

## 🚀 Puesta en Marcha

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Variables de Entorno (Opcional si usas Supabase en vivo)
Crea o edita el archivo `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```
*(Si no se configuran, la aplicación opera en modo demostración autónomo sin romperse).*

### 3. Ejecutar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 4. Compilación para Producción
```bash
npm run build
```
Genera los archivos estáticos optimizados en la carpeta `dist/`.
