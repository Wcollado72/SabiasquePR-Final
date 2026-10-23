# Índice de la entrega — Sabías que PR (COMP2053)

Proyecto final de **COMP2053 — Desarrollo Web Full-Stack**, Universidad Interamericana de Puerto Rico, Recinto de Fajardo.
Este índice dice **qué pide la rúbrica y dónde está cada cosa** en este repositorio.

## Qué pide la rúbrica → dónde está

| Qué pide la rúbrica | Dónde está en el repositorio |
|---|---|
| Código fuente del frontend | Carpeta [`/frontend`](../../frontend) (páginas HTML generadas por `build.js`, scripts JS, CSS, imágenes, textos en español e inglés) |
| Código fuente del backend (API y base de datos) | Carpeta [`/backend`](../../backend) (`src/routes`, `src/middleware`, `src/validators`, `sql/schema.sql`, pruebas automáticas) |
| README | [`README.md`](../../README.md) en la raíz (descripción, instalación, ejecución, pruebas, estructura, despliegue) |
| Documento PDF final | [`Documento-Final-SabiasquePR.pdf`](Documento-Final-SabiasquePR.pdf) |
| Manual de usuario | [`Manual-de-usuario-SabiasquePR.pdf`](Manual-de-usuario-SabiasquePR.pdf) |
| Documentación técnica | [`Documentacion-Tecnica-SabiasquePR.pdf`](Documentacion-Tecnica-SabiasquePR.pdf) (versión en texto: [`documentacion-tecnica.md`](documentacion-tecnica.md), generada desde el código) |
| Planificación y diseño de la base de datos | [`planificacion-y-diseno-bd.pdf`](planificacion-y-diseno-bd.pdf) (diagramas, modelo entidad-relación, diccionario de datos y script SQL) |
| Evidencia de pruebas | [`Evidencia-de-pruebas-SabiasquePR.pdf`](Evidencia-de-pruebas-SabiasquePR.pdf) (datos de origen: `evidencia-pruebas.json`, `evidencia-navegadores.json`, `evidencia-produccion.json`) |
| Capturas de pantalla | Carpeta [`capturas/`](capturas) (escritorio y móvil) |
| Video de demostración | Guion del video: [`guiones-video.md`](guiones-video.md) |
| Aplicación desplegada en línea | **https://sabiasquepr.com** (frontend en Netlify; API en Render; base de datos en Supabase) |

## Cómo ejecutar el proyecto

Backend: `cd backend && npm install && npm run dev`. Frontend: `cd frontend && node build.js` y luego `npx http-server -p 5500 -c-1 .`.
Los pasos completos (variables de entorno, base de datos, pruebas) están en el [`README.md`](../../README.md).

## Nota sobre `docs/interno/`

La carpeta [`docs/interno/`](../interno) contiene **material de trabajo del proyecto** (planes del corte, registro de accesos, auditorías, hojas de trabajo, borradores). **No es parte de la entrega.**
