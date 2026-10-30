# 🏙️ City Chaos — Build & Destroy

Proyecto 2 · Taller de la Computación

Videojuego web en el que **dos usuarios autenticados** construyen y destruyen una ciudad sobre un mapa de 12 × 12. Los cambios se guardan en **Supabase** y se reciben en tiempo real, incluso desde dispositivos diferentes.

## Funciones implementadas
- Crear casas 🏠, edificios 🏢, calles 🛣️, árboles 🌳 y jardines 🌷.
- Destruir con un meteorito ☄️ (zona de 3 × 3) o borrar una sola casilla.
- Usar diferentes salas con códigos y enlaces compartibles.
- Iniciar sesión con **correo y contraseña** de Supabase Authentication.
- Compartir modificaciones entre navegadores con **Supabase Realtime** (Postgres Changes y Broadcast).
- Guardar el mapa en una tabla de Supabase y recuperarlo tras refrescar o volver a entrar a la misma sala.
- Mostrar jugadores conectados mediante Presence y actividad de la sesión.

**El código está implementado; para funcionar entre dispositivos debe configurarse y probarse con tu proyecto Supabase y el despliegue de Vercel.**

## Archivos
- `index.html`: interfaz del juego y formulario de acceso.
- `styles.css`: diseño, efectos y adaptación a pantallas.
- `app.js`: lógica de construcción, destrucción, inicio de sesión, guardado y multijugador.
- `package.json`: dependencias y comandos de Vite.
- `vercel.json`: configuración de compilación de Vercel.
- `.env.example`: ejemplo sin credenciales.
- `firebase-config.js`: archivo de la primera versión; **ya no se usa**.

## 1. Base de datos de Supabase

En Supabase → SQL Editor ejecuta estas instrucciones **solo si todavía no creaste la tabla**:

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

create policy "Los jugadores pueden ver ciudades"
  on public.city_tiles for select
  to authenticated using (true);

create policy "Los jugadores pueden construir"
  on public.city_tiles for insert
  to authenticated with check (true);

create policy "Los jugadores pueden modificar construcciones"
  on public.city_tiles for update
  to authenticated using (true) with check (true);

create policy "Los jugadores pueden destruir construcciones"
  on public.city_tiles for delete
  to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='city_tiles'
  ) then
    alter publication supabase_realtime add table public.city_tiles;
  end if;
end $$;

alter table public.city_tiles replica identity full;
```

> **Nota:** las políticas permiten a cualquier usuario autenticado leer y modificar todas las salas conocidas. Es suficiente para la práctica colaborativa, pero **no son salas privadas ni reglas apropiadas para datos sensibles**. No introduzcas datos personales en la ciudad. Para uso público serio haría falta restringir membresías, validar acciones y aplicar límites.

## 2. Crear los dos jugadores de prueba

En Supabase → **Authentication → Users → Add user → Create new user**, crea dos cuentas de prueba con correos diferentes y contraseñas diferentes. Si aparece, selecciona la opción para confirmar el usuario automáticamente.

**No pongas las contraseñas en GitHub ni en Vercel.** El juego pide correo y contraseña desde su propio formulario y utiliza `supabase.auth.signInWithPassword()`.

## 3. Variables de entorno de Vercel

En Vercel → tu proyecto → **Settings → Environment Variables**, configura ambas variables de tipo **Config**:

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL de Supabase, p. ej. `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Tu clave web `sb_publishable_...` |

Usa Production y, si quieres probar despliegues de vista previa, también Preview.

> `VITE_` expone estas variables en el navegador mediante el build de Vite. **Solo** usa la URL y la clave *publishable*, nunca `sb_secret_` ni una contraseña de un usuario.

## 4. Vercel: compilar y publicar

El repositorio utiliza **Vite**, no un sitio HTML sin build:
- Framework Preset: **Vite**.
- Build Command: `npm run build`.
- Output Directory: `dist`.
- Root Directory: raíz del repositorio (`./`).

`vercel.json` ya define la configuración básica. Con el repositorio conectado a Vercel, las nuevas confirmaciones (commits) pueden generar un despliegue. Comprueba en **Deployments** que el más reciente está listo y es el de tu repositorio `nexiqu/Proyecto2`; si sigue mostrando el despliegue anterior, pulsa **Redeploy** o revisa la conexión del repositorio.

Para desarrollo local, usa Node.js, `npm install`, copia `.env.example` como `.env.local`, coloca tus variables reales y ejecuta `npm run dev`.

## 5. Prueba del laboratorio

1. Abre el sitio publicado de Vercel en un navegador normal y entra con la **primera cuenta de prueba**.
2. Abre exactamente la **misma URL de sala** en incógnito o en otro navegador/dispositivo, con la **segunda cuenta**.
3. Construye una casa en la primera ventana: debe aparecer en la segunda **sin recargar**.
4. Planta un árbol en la segunda: debe aparecer en la primera.
5. Lanza un meteorito en la primera: ambos mapas deben mostrar las mismas casillas destruidas.
6. **Refresca las dos páginas**: la ciudad debe permanecer igual.
7. Si aparece algún error, comprueba la consola del navegador, las reglas RLS, las variables de Vercel y que `city_tiles` esté en la publicación `supabase_realtime`.

## Etapas siguientes
- Más edificios y decoraciones.
- Láser y efectos visuales adicionales.
- Puntuaciones, objetivos y acceso a salas privadas.

## Tecnologías
HTML · CSS · JavaScript · **Vite** · **Supabase Authentication** · **Supabase Database** · **Supabase Realtime** · **Vercel**
