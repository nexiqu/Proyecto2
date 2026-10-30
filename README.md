# 🏙️ City Chaos — Build & Destroy

**Proyecto 2 · Taller de la Computación (CMP1001)**

Una ciudad 2D que dos jugadores pueden **construir y destruir al mismo tiempo**. Las acciones se reflejan en ambos dispositivos en tiempo real y el mapa se mantiene guardado tras actualizar la página **cuando Firebase está configurado**.

## 🎮 ¿Cómo se juega?

1. Abre la aplicación y selecciona una herramienta.
2. Haz clic o toca las casillas del mapa para colocar casas 🏠, edificios 🏢, carreteras 🛣️, árboles 🌳 o jardines 🌷.
3. Selecciona **meteorito ☄️** y toca una casilla: destruye las construcciones de una zona de **3 × 3** con una animación. También hay una herramienta para borrar una casilla.
4. Comparte el enlace de la sala con el otro jugador. Ambos podrán editar la **misma ciudad** y ver los cambios casi inmediatamente.
5. Recarga la página: el mapa se recupera desde la base de datos.

Los atajos **1–7** permiten cambiar rápidamente entre herramientas.

## ✅ Estado actual del proyecto

**Implementado:**
- Interfaz visual adaptable a computadora y celular.
- Mapa 2D de **12 × 12** con una ciudad inicial de ejemplo.
- Construcción y reemplazo de objetos en casillas.
- Meteorito que elimina los objetos existentes de hasta 9 casillas y reproduce una animación.
- Herramienta para eliminar una casilla.
- Estadísticas del mapa y actividad reciente.
- Salas compartibles mediante URL (`?sala=CODIGO`), alias de jugadores y usuarios conectados.
- **Persistencia y sincronización Firebase Realtime Database:** código implementado y preparado para conectar.
- **Modo demo local:** funciona de inmediato y conserva el mapa en el navegador mediante `localStorage`.

**Pendiente para tener multijugador funcional en línea:** conectar un proyecto de Firebase y publicar la web. El repositorio no incluye credenciales ni un proyecto de Firebase configurado. **La demo local no sincroniza dispositivos**: su guardado solo existe en ese navegador.

## 📁 Archivos

| Archivo | Función |
| --- | --- |
| `index.html` | Estructura e interfaz del juego |
| `styles.css` | Estilos adaptables, mapa, herramientas y efectos |
| `app.js` | Reglas, meteorito, persistencia y sincronización |
| `firebase-config.js` | Configuración del proyecto Firebase (actualmente vacía) |
| `README.md` | Instrucciones del proyecto |

## 🔥 Activar multijugador real y guardado en la nube

GitHub Pages publica archivos estáticos, pero **no proporciona por sí mismo una base de datos**. Para que dos jugadores vean las acciones del otro y el progreso sobreviva a una recarga desde cualquier dispositivo:

### 1. Crear Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/) e inicia sesión.
2. Crea un proyecto nuevo (por ejemplo, `city-chaos`).
3. En **Build → Realtime Database**, crea una base de datos.
4. En **Build → Authentication → Sign-in method**, activa **Anonymous**. No es necesario que los estudiantes creen cuentas de correo para esta primera versión.
5. En **Project settings → Your apps**, registra una aplicación **Web** (`</>`) y copia el objeto de configuración de Firebase.

### 2. Configurar las reglas
En **Realtime Database → Rules**, reemplaza las reglas por las siguientes para la práctica:

```json
{
  "rules": {
    "rooms": {
      "$room": {
        "world": {
          ".read": "auth != null",
          ".write": "auth != null"
        },
        "presence": {
          ".read": "auth != null",
          "$uid": {
            ".write": "auth != null && auth.uid === $uid"
          }
        }
      }
    }
  }
}
```

Publícalas. Estas reglas permiten que los usuarios autenticados anónimamente compartan el mapa y que cada uno gestione únicamente su propio indicador de presencia. **Son reglas básicas de laboratorio**, no un sistema de protección de salas privadas: cualquiera que conozca el código de una sala podría entrar y modificarla. Para producción, conviene añadir permisos, validaciones y límites de escritura.

### 3. Completar `firebase-config.js`
Pega **los valores de tu propia aplicación web** en el archivo. Ejemplo de estructura (los textos entre comillas son marcadores):

```js
export const firebaseConfig = {
  apiKey: "TU_API_KEY_WEB",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_BASE_DE_DATOS.firebasedatabase.app",
  projectId: "TU_PROYECTO",
  appId: "TU_APP_ID"
};
```

No copies exactamente el ejemplo: los valores reales deben venir de Firebase Console. **Nunca subas contraseñas, claves privadas ni archivos de cuentas de servicio a GitHub.** La configuración web pública de Firebase se protege mediante las reglas de acceso y autenticación.

### 4. Publicar con GitHub Pages
1. Abre **Settings → Pages** en este repositorio.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige **main**, carpeta **/(root)** y guarda.
4. Cuando GitHub termine de publicar, abre el enlace que muestra Pages. El juego debe indicar **«En tiempo real»** si Firebase quedó correctamente configurado.

También puedes probarlo usando un servidor local sencillo (por ejemplo, Live Server en VS Code). No abras el archivo HTML con `file://` porque utiliza módulos JavaScript.

## 🧪 Pruebas para el laboratorio

| Prueba | Resultado esperado |
| --- | --- |
| Jugador A coloca una casa | El jugador B la ve sin recargar |
| Jugador B coloca un árbol | El jugador A lo ve sin recargar |
| A lanza un meteorito sobre varios objetos | Ambos ven desaparecer las mismas construcciones |
| A y B editan casi al mismo tiempo | Los cambios se aplican sobre una única ciudad compartida |
| Refrescar las dos páginas | El mapa sigue exactamente como estaba |
| Abrir la misma sala desde otro dispositivo | Aparece la ciudad guardada en Firebase |
| Abrir dos salas con códigos distintos | Cada una mantiene su mapa independiente |
| Desactivar Firebase | Sigue funcionando la demo local, pero **no** hay sincronización entre dispositivos |

**Importante:** una ciudad nueva se inicia con algunas calles, casas y decoraciones de ejemplo para no aparecer completamente vacía.

## 🧭 Próximas mejoras
- Nuevas construcciones: hospital, tiendas, parques y plazas.
- Rayo láser, terremotos y más efectos visuales.
- Salas privadas con controles de acceso.
- Sistema de logros y puntuaciones.
- Mejoras en animaciones y gráficos.

## 🧩 Tecnologías
HTML · CSS · JavaScript (ES Modules) · Firebase Realtime Database · Firebase Authentication anónima · GitHub Pages

**Objetivo del laboratorio:** que dos jugadores vean las acciones del otro en tiempo real y que el estado de la ciudad permanezca al actualizar la página.
