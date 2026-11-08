# 🏙️ City Chaos — Build & Destroy

**Proyecto 2 · Taller de la Computación**

City Chaos es una aplicación web colaborativa en la que varias personas construyen y modifican una ciudad compartida sobre un tablero de **12 × 12 casillas**. Cada jugador inicia sesión con una cuenta de Supabase, entra a una sala y puede colocar construcciones o destruirlas. El estado del mapa se almacena en Supabase para que siga disponible después de recargar la página o abrirla en otro dispositivo.

- **Aplicación publicada:** https://proyecto22-gamma.vercel.app/
- **Repositorio:** https://github.com/nexiqu/Proyecto2
- **Rama principal:** `main`

---

## Tabla de contenidos

- [Características](#características)
- [Tecnologías y cómo funciona](#tecnologías-y-cómo-funciona)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Configuración de Supabase](#1-configuración-de-supabase)
  - [Crear la tabla](#11-crear-la-tabla)
  - [Registrar autores y jugadores presentes](#12-registrar-autores-y-jugadores-presentes)
  - [Crear usuarios de prueba](#13-crear-usuarios-de-prueba)
  - [Obtener las credenciales públicas](#14-obtener-las-credenciales-públicas)
- [Variables de entorno](#2-variables-de-entorno)
- [Ejecutar en local](#3-ejecutar-en-local)
- [Publicar en Vercel](#4-publicar-en-vercel)
- [Probar el modo multijugador](#5-probar-el-modo-multijugador)
- [Solución de problemas](#solución-de-problemas)
- [Limitaciones conocidas y siguientes pasos](#limitaciones-conocidas-y-siguientes-pasos)
- [Seguridad](#seguridad)

## Características

### Construcción
- **Casita:** coloca una casa en una casilla.
- **Edificio:** coloca un edificio.
- **Carretera:** crea caminos.
- **Árbol:** agrega naturaleza.
- **Jardín:** agrega flores y zonas verdes.

### Destrucción
- **Meteorito:** elimina las construcciones dentro de un área de hasta 3 × 3 casillas alrededor del punto seleccionado. Cerca de los bordes del tablero, el área se limita al mapa.
- **Tornado:** arrasa las construcciones dentro de un área de hasta 5 × 5 casillas. Tiene una vista previa violeta y una animación giratoria; cerca de los bordes, el área se limita al mapa.
- **Rayo desintegrador:** despeja una línea horizontal de hasta 7 casillas centrada en el punto seleccionado. La franja se previsualiza en celeste y recibe una animación luminosa antes de eliminarse.
- **Bomba nuclear:** reinicia por completo el mapa de la sala actual. Muestra una vista previa de todo el tablero, reproduce un efecto arcade y solicita confirmación porque no se puede deshacer. No afecta a otras salas.
- **Eliminar:** borra el objeto de una sola casilla.
- **Atajos de destrucción:** 6 Meteorito, 7 Tornado, 8 Rayo desintegrador, 9 Bomba nuclear y 0 Eliminar.

### Salas y persistencia
- Cada sala tiene un código, por ejemplo `CIUDAD-01`.
- Se puede crear una sala nueva o compartir el enlace de una sala existente.
- El código de sala se incluye en la dirección como parámetro `?sala=...`.
- Las construcciones se guardan en Supabase y se recuperan al entrar nuevamente a esa sala.
- Los cambios de otros jugadores se consultan automáticamente cada **800 ms aproximadamente**, mientras la pestaña está visible. No hace falta recargar la página.
- **Autoría por objeto:** cada construcción guarda el UUID de la cuenta que la colocó (`created_by`, vinculado a `auth.users.id`) y un nombre legible. El nombre aparece abreviado sobre la casilla y completo al pasar el cursor.
- **Jugadores presentes:** el panel muestra las cuentas activas en la sala. Cada navegador actualiza su presencia cada 10 segundos; se considera presente a quien haya actualizado su registro durante los últimos 35 segundos. La lista se refresca cada 3 segundos.

### Cuentas
- El acceso se realiza con correo y contraseña mediante Supabase Authentication.
- Las cuentas de prueba se crean desde el panel de Supabase; la aplicación no tiene un formulario público de registro.

## Tecnologías y cómo funciona

- **HTML, CSS y JavaScript** para la interfaz y la lógica del juego.
- **Vite** para desarrollo y compilación.
- **Supabase Authentication** para iniciar y cerrar sesión.
- **Supabase Database (Postgres) y REST API** para leer, guardar y eliminar construcciones.
- **Vercel** para publicar la aplicación.

La aplicación llama directamente a los endpoints HTTPS de Supabase desde `app.js`. La sesión se conserva en el almacenamiento local del navegador y se renueva cuando es necesario. La sincronización del mapa consulta periódicamente `city_tiles`; la lista de personas conectadas consulta `city_presence`. **Esta versión no utiliza Supabase Realtime ni WebSockets**.

## Estructura del proyecto

| Archivo | Función |
| --- | --- |
| `index.html` | Estructura de la página, tablero, herramientas, sala y formulario de inicio de sesión. |
| `styles.css` | Estilos, distribución adaptable, animaciones y apariencia visual. |
| `app.js` | Inicio de sesión, gestión de sesión, construcción, destrucción, lectura y escritura de datos, y sincronización periódica. |
| `package.json` | Dependencias y comandos de Vite. |
| `vercel.json` | Configuración de compilación y publicación en Vercel. |
| `.env.example` | Nombres de las variables necesarias, con valores de ejemplo que no son credenciales reales. |
| `.gitignore` | Archivos locales y secretos que no deben subirse al repositorio. |
| `supabase/migrations/20261107_city_ownership_and_presence.sql` | Migración para registrar la cuenta autora de cada objeto y los jugadores presentes en cada sala. |

## Requisitos

Para trabajar con el proyecto necesitas:

- Node.js (versión LTS recomendada) y npm.
- Una cuenta de Supabase y un proyecto de base de datos.
- Una cuenta de Vercel para publicar la aplicación.
- Un repositorio GitHub conectado a Vercel (opcional para ejecutar localmente).

## 1. Configuración de Supabase

### 1.1 Crear la tabla

Abre tu proyecto en Supabase, entra en **SQL Editor → New query**, pega el siguiente SQL y pulsa **Run**.

Este script crea la tabla si no existe y configura las políticas de acceso para usuarios autenticados. Los `DROP POLICY IF EXISTS` permiten volver a ejecutar la configuración sin duplicar las políticas.

```sql
create table if not exists public.city_tiles (
  room_id text not null,
  row_index integer not null check (row_index between 0 and 11),
  col_index integer not null check (col_index between 0 and 11),
  object_type text not null check (
    object_type in ('house', 'building', 'road', 'tree', 'park')
  ),
  updated_at timestamptz not null default now(),
  primary key (room_id, row_index, col_index)
);

alter table public.city_tiles enable row level security;

drop policy if exists "Los jugadores pueden ver ciudades"
  on public.city_tiles;
create policy "Los jugadores pueden ver ciudades"
  on public.city_tiles for select
  to authenticated using (true);

drop policy if exists "Los jugadores pueden construir"
  on public.city_tiles;
create policy "Los jugadores pueden construir"
  on public.city_tiles for insert
  to authenticated with check (true);

drop policy if exists "Los jugadores pueden modificar construcciones"
  on public.city_tiles;
create policy "Los jugadores pueden modificar construcciones"
  on public.city_tiles for update
  to authenticated using (true) with check (true);

drop policy if exists "Los jugadores pueden destruir construcciones"
  on public.city_tiles;
create policy "Los jugadores pueden destruir construcciones"
  on public.city_tiles for delete
  to authenticated using (true);
```

La clave primaria compuesta `(room_id, row_index, col_index)` permite almacenar como máximo un objeto por casilla y sala. Al construir sobre una casilla ocupada, la aplicación reemplaza el objeto existente.

**Importante:** la aplicación usa consultas REST periódicas. No necesitas agregar `city_tiles` a la publicación `supabase_realtime` para que funcione esta versión.

### 1.2 Registrar autores y jugadores presentes

Después de crear `city_tiles`, ejecuta la migración del repositorio:

`supabase/migrations/20261107_city_ownership_and_presence.sql`

Abre el archivo en GitHub, copia el SQL completo y ejecútalo en **Supabase → SQL Editor → New query → Run**. Esta migración añade:

- `created_by`: UUID vinculado a `auth.users.id`, que identifica la cuenta que colocó el objeto actual.
- `created_by_name`: nombre legible que se muestra en el tablero. Si alguien reemplaza un objeto, el nuevo objeto queda atribuido a quien lo colocó.
- `city_presence`: tabla con una fila por cuenta y sala (`room_id`, `user_id`, `display_name`, `last_seen`).
- Políticas RLS para que cada usuario solo pueda crear, actualizar o borrar su propio registro de presencia. Las construcciones nuevas también deben registrar el ID de la cuenta autenticada.

**Cómo se ve en la aplicación:**
- Cada casilla ocupada muestra una etiqueta pequeña con las primeras letras del nombre de quien construyó el objeto. Al pasar el cursor sobre la casilla se puede leer el nombre completo.
- El UUID `created_by` es el vínculo real con la cuenta de Supabase. El campo `created_by_name` es solo una etiqueta legible.
- Las construcciones que ya existían antes de ejecutar la migración no tienen un autor recuperable; aparecerán como **Autor no registrado**. Las nuevas sí quedarán atribuidas.
- El panel **Jugadores** muestra quienes están presentes en esa sala. El navegador renueva su presencia cada 10 segundos y la lista se consulta cada 3 segundos.
- Si alguien cierra la pestaña o pierde conexión inesperadamente, su registro puede seguir visible hasta 35 segundos. Al cerrar sesión o cambiar de sala, la aplicación intenta retirarlo inmediatamente.

Ejecuta la migración después de la sección 1.1 y antes de desplegar la versión del código que usa estas columnas y la tabla de presencia.

### 1.3 Crear usuarios de prueba

1. En Supabase, abre **Authentication → Users**.
2. Pulsa **Add user → Create new user**.
3. Crea una cuenta con un correo de prueba y una contraseña.
4. Si aparece la opción, confirma automáticamente el usuario.
5. Repite el proceso para crear una segunda cuenta con otro correo.

Usa las dos cuentas para probar la interacción desde dos navegadores o dispositivos diferentes. No publiques las contraseñas.

### 1.4 Obtener las credenciales públicas

En el panel de Supabase, abre **Connect** o **Project Settings → API Keys / Data API** y copia:

- **Project URL**, con formato `https://<tu-proyecto>.supabase.co`.
- **Publishable key**, que comienza con `sb_publishable_`.

Los nombres de las variables deben coincidir exactamente con los que utiliza el código.

## 2. Variables de entorno

La aplicación necesita estas dos variables:

| Nombre | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL de tu proyecto Supabase. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key de Supabase (`sb_publishable_...`). |

### En Vercel

1. Abre el proyecto en Vercel.
2. Ve a **Settings → Environment Variables**.
3. Agrega cada variable con su nombre y valor.
4. Selecciona **Production** y también **Preview** si usarás despliegues de prueba.
5. Guarda los cambios y vuelve a desplegar el proyecto (**Redeploy**).

### En tu computadora

Copia `.env.example` a un archivo llamado `.env.local` y reemplaza los valores de ejemplo por tus credenciales reales.

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave
```

No subas `.env.local` al repositorio. Vite incorpora al código del navegador las variables que empiezan por `VITE_`; por eso solo se debe usar la clave pública **publishable**. Nunca uses una clave `sb_secret_`, una contraseña o una credencial de administración en el frontend.

## 3. Ejecutar en local

Clona el repositorio y entra a la carpeta:

```bash
git clone https://github.com/nexiqu/Proyecto2.git
cd Proyecto2
```

Instala las dependencias:

```bash
npm install
```

Crea `.env.local` siguiendo la sección anterior y ejecuta el servidor de desarrollo:

```bash
npm run dev
```

Vite mostrará una dirección local, normalmente `http://localhost:5173`. Ábrela en el navegador.

Para comprobar que el proyecto compila para producción:

```bash
npm run build
```

Para previsualizar el resultado compilado:

```bash
npm run preview
```

## 4. Publicar en Vercel

1. En Vercel, selecciona **Add New → Project**.
2. Importa el repositorio `nexiqu/Proyecto2` desde GitHub.
3. Comprueba que el framework detectado sea **Vite**.
4. Configura la carpeta raíz como `./`.
5. Usa estos valores si Vercel los solicita:

   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

6. Añade las dos variables de entorno de Supabase.
7. Pulsa **Deploy**.

El archivo `vercel.json` ya contiene la configuración de Vite. Si el repositorio está conectado, los nuevos commits a la rama principal pueden iniciar despliegues automáticos. Comprueba en **Deployments** que el despliegue más reciente termine con estado **Ready**.

## 5. Probar el modo multijugador

1. Abre la aplicación publicada: https://proyecto22-gamma.vercel.app/
2. Inicia sesión con la primera cuenta de Supabase.
3. Deja la sala `CIUDAD-01` o crea una sala y copia su enlace.
4. Abre el mismo enlace en otro navegador, una ventana privada o un segundo dispositivo.
5. Inicia sesión con la segunda cuenta.
6. Coloca una casa en la primera ventana. El objeto debe aparecer en la otra después de la siguiente consulta automática.
7. Coloca un árbol desde la segunda ventana y comprueba que aparezca en la primera.
8. Prueba **Eliminar**, **Meteorito**, **Tornado** y **Rayo desintegrador** para comprobar que la destrucción también se comparte. El tornado afecta hasta 25 casillas y el rayo despeja una línea de hasta 7.
9. Recarga ambas páginas. La ciudad debe conservar las construcciones que no fueron eliminadas.
10. Pasa el cursor sobre una casilla ocupada y confirma que se muestre el nombre de quien construyó ese objeto.
11. Comprueba que el panel **Jugadores** muestre los dos nombres mientras las dos cuentas estén conectadas a la misma sala.
12. Cierra sesión en una de las ventanas y comprueba que esa cuenta desaparezca de la lista. Si cierras el navegador sin cerrar sesión, espera hasta 35 segundos para que expire su presencia.
13. Para probar **Bomba nuclear**, crea una sala de prueba, construye algunos objetos y actívala. Confirma el aviso: se borrará todo el mapa de esa sala de manera irreversible, pero no se modificarán otras salas.

**Nota sobre la simultaneidad:** la sincronización es automática, pero no es un flujo instantáneo de WebSocket. La otra pantalla suele reflejar el cambio en el siguiente ciclo de consulta (aproximadamente 0,8 segundos, si la pestaña está visible).

## Solución de problemas

| Problema | Qué revisar |
| --- | --- |
| La página dice que faltan variables de Supabase. | Verifica que los nombres sean exactamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, que tengan valores correctos y que se haya hecho un nuevo deploy. |
| Aparece un error de inicio de sesión. | Comprueba el correo, la contraseña y que el usuario exista y esté confirmado en **Supabase → Authentication → Users**. |
| El inicio de sesión funciona, pero no se conecta la ciudad. | Revisa que la tabla `public.city_tiles` exista, que las políticas RLS estén activas y que el usuario esté autenticado. |
| No aparece quién construyó un objeto. | Confirma que ejecutaste la migración `20261107_city_ownership_and_presence.sql`. Los objetos colocados antes de esa migración no tienen autor histórico. |
| El panel Jugadores no muestra a la otra persona. | Comprueba que ambos usen el mismo código de sala y que la migración haya creado `city_presence`. La presencia tarda hasta 3 segundos en actualizarse y caduca tras 35 segundos sin latido. |
| Se puede entrar, pero no guardar o eliminar. | Revisa las políticas de INSERT y DELETE, la estructura de la tabla y los mensajes de error en la consola del navegador. |
| El segundo navegador no ve los cambios. | Confirma que ambos estén en el mismo código de sala, que las dos sesiones estén activas y que la pestaña esté visible. |
| Vercel sigue mostrando una versión anterior. | Revisa **Deployments**, confirma que se publicó el último commit y ejecuta **Redeploy** si hace falta. |
| Funciona localmente, pero no en Vercel. | Compara las variables de entorno de Production con las de tu archivo local y vuelve a desplegar después de cambiarlas. |

Para investigar un error, abre las herramientas de desarrollador del navegador (**F12 → Console**) y revisa el mensaje que aparece al intentar iniciar sesión, construir o destruir.

## Limitaciones conocidas y siguientes pasos

Esta es una primera versión funcional y pequeña, no una plataforma terminada.

- La lista de jugadores muestra al usuario de la sesión actual; todavía no hay un sistema completo de presencia para mostrar en vivo a todos los jugadores conectados.
- El panel de actividad refleja acciones de la sesión local; no es un historial compartido y persistente de todas las personas.
- La sincronización usa consultas periódicas cada ~800 ms y se pausa cuando la pestaña está oculta.
- Las salas usan códigos compartibles, pero no tienen invitaciones, membresías ni privacidad por sala.
- Las herramientas actuales son casas, edificios, carreteras, árboles, jardines, meteorito, tornado, rayo desintegrador, bomba nuclear y eliminación individual.
- Más objetos, efectos y funciones adicionales pueden añadirse en siguientes versiones.

### Ideas para continuar

1. Agregar nuevos edificios, decoraciones y herramientas.
2. Añadir nuevas variantes de herramientas y efectos visuales.
3. Añadir presencia de jugadores conectados.
4. Crear un historial compartido de acciones.
5. Mejorar los permisos para que cada sala tenga miembros autorizados.

## Seguridad

Este proyecto está diseñado como práctica académica y utiliza una configuración de base de datos sencilla:

- Las políticas SQL permiten a **cualquier usuario autenticado** leer, insertar, modificar y eliminar registros de `city_tiles`; las escrituras nuevas exigen que `created_by` sea el ID de la cuenta autenticada. No restringen el acceso a una sala a sus participantes.
- En `city_presence`, cada usuario solo puede escribir o borrar su propio registro, pero todos los usuarios autenticados pueden consultar los nombres presentes en la sala.
- El código de sala sirve para organizar los datos, pero no es una contraseña ni una barrera de seguridad.
- No guardes información personal, privada o sensible en la ciudad.
- Para una aplicación pública real habría que añadir membresías de sala, políticas RLS que validen esas membresías, controles de abuso y validación de acciones en el servidor.
- Nunca compartas contraseñas, claves secretas ni archivos `.env.local`.

---

## Autoría y propósito

City Chaos fue creado como proyecto académico para explorar el desarrollo de una aplicación web compartida, autenticación, persistencia de datos y sincronización entre varios navegadores.

**Hecho para crear, compartir y destruir.** 🏙️
