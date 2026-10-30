# Proyecto 2 — City Chaos: Build & Destroy 🏙️☄️

## Descripción
**City Chaos: Build & Destroy** es un videojuego colaborativo de construcción y destrucción de una ciudad. Dos jugadores, desde navegadores o dispositivos distintos, pueden modificar **el mismo mapa en tiempo real**: colocar edificios, calles y decoraciones, o destruir zonas de la ciudad con un meteorito. Todas las modificaciones se guardan para recuperarlas al recargar la página.

## Objetivo
Crear una ciudad compartida que pueda construirse y modificarse entre varias personas, demostrando sincronización entre usuarios y persistencia de datos.

## Funcionalidades de la primera versión (laboratorio)
- **Mapa 2D:** cuadrícula inicial de 12 × 12 casillas, vista desde arriba.
- **Construcción:** colocar casas, edificios, calles y árboles seleccionando una herramienta y una casilla.
- **Destrucción:** seleccionar **meteorito** y hacer clic en una casilla para destruir las construcciones de un área de 3 × 3, dentro de los límites del mapa; incluir una animación sencilla.
- **Multijugador simultáneo:** dos usuarios pueden editar la misma ciudad; los cambios de ambos se reflejan automáticamente en las dos pantallas, sin recargar.
- **Guardado persistente:** las construcciones, las calles, las decoraciones y las casillas vacías por destrucción se almacenan en una base de datos. Al refrescar la página o entrar desde otro dispositivo, se recupera el mapa compartido.
- **Barra de herramientas:** permite cambiar entre objetos para construir y meteorito para destruir.
- **Publicación web:** aplicación accesible por enlace para probarla desde dos navegadores o dispositivos.

## Requisitos del Proyecto 2
| Requisito | Cómo se cumplirá |
| --- | --- |
| Sigue ahí al recargar | Guardar el estado compartido de la ciudad en una base de datos y recuperarlo al abrir la página. |
| Dos usuarios interactúan | Ambos pueden construir y destruir sobre el mismo mapa; cada cambio se sincroniza en tiempo real. |
| Inicio de sesión | No es obligatorio en este laboratorio; queda como mejora para una versión posterior, con cuentas de correo de prueba. |

## Tecnologías propuestas
- **HTML:** estructura de la página, tablero y controles.
- **CSS:** diseño de la ciudad, edificios, herramientas y animaciones.
- **JavaScript:** reglas para colocar y destruir objetos.
- **Firebase Realtime Database:** sincronización y almacenamiento persistente compartido. Se configurarán reglas de acceso adecuadas; GitHub Pages por sí solo no guarda datos compartidos.
- **GitHub Pages:** publicación del juego.

> **Estado:** planificación. Estas funciones describen lo que se implementará; aún no se presentan como terminadas.

## Etapas de desarrollo
### Etapa 1 — Laboratorio
1. Diseñar y mostrar el tablero 2D.
2. Crear herramientas de construcción para casa, edificio, calle y árbol.
3. Implementar el meteorito que destruye un área de 3 × 3.
4. Conectar la base de datos para guardar y recuperar el mapa.
5. Sincronizar los cambios en vivo entre dos navegadores.
6. Publicar y comprobar que funciona después de recargar.

### Etapa 2 — Mejoras
- Agregar parques, tiendas, hospitales y más decoraciones.
- Mejorar los dibujos y las animaciones del meteorito.
- Incorporar controles para evitar sobrescribir accidentalmente cambios simultáneos.

### Etapa 3 — Versión final
- Nuevas herramientas: rayo láser, terremoto y otras.
- Salas o ciudades separadas.
- Identificación de jugadores e inicio de sesión.
- Mejor interfaz, efectos y posibles retos o puntuaciones.

## Pruebas necesarias
- Abrir el mismo enlace en dos navegadores o dispositivos.
- Colocar una casa desde el jugador A y verificar que aparece inmediatamente para B.
- Colocar una calle o árbol desde B y comprobar que A ve el cambio.
- Lanzar un meteorito y confirmar que ambos ven las mismas casillas destruidas.
- Recargar los dos navegadores y verificar que todas las construcciones y destrucciones permanecen.
- Abrir la página desde un tercer navegador y comprobar que recupera el mismo mapa.

## Criterio de éxito del laboratorio
Una versión pequeña y publicada en la que dos personas modifican la misma ciudad, **ven los cambios sin recargar** y **no pierden el estado del mapa cuando actualizan la página**.
