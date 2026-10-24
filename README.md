# Sabías que PR

[![Pruebas y calidad del código](https://github.com/Wcollado72/SabiasquePR-Final/actions/workflows/ci.yml/badge.svg)](https://github.com/Wcollado72/SabiasquePR-Final/actions/workflows/ci.yml)

Aplicación web full-stack de noticias con contexto, educación y debate comunitario. Proyecto final de **COMP2053 — Desarrollo Web Full-Stack**, Universidad Interamericana de Puerto Rico, Recinto de Fajardo.

- **Sitio en línea:** https://sabiasquepr.com
- **API:** https://sabiasquepr-backend-uufz.onrender.com (el plan gratuito de Render puede tardar ~50 segundos en despertar la primera vez)
- **Para la profesora:** empieza por [`docs/entrega/Guia-para-la-profesora.pdf`](docs/entrega/Guia-para-la-profesora.pdf) (1 página: cuenta de prueba, dónde está cada punto de la rúbrica y cómo correr las pruebas).

## Qué incluye
Frontend responsivo (HTML5, CSS3 y JavaScript sin framework) que consume una **API REST propia** (Node.js + Express) conectada a **PostgreSQL** (Supabase).

- **CRUD completo** en noticias, contenidos, productos y publicaciones del debate; comentarios, reportes y órdenes con las operaciones que les corresponden.
- **Autenticación con JWT** emitido por Supabase Auth y **verificado en el servidor** en cada ruta protegida; roles (usuario, colaborador, moderador, administrador) y verificación en dos pasos para el panel de administración.
- Validación de datos en el servidor, manejo de errores, rutas protegidas y sitio bilingüe (español/inglés).

## Instalación y ejecución
Requisitos: Node.js 18.18 o superior (se prueba con Node 22), npm y una base de datos PostgreSQL (se usa Supabase).
```bash
git clone https://github.com/Wcollado72/SabiasquePR-Final.git
cd SabiasquePR-Final/backend
npm install
cp .env.example .env        # completa los valores (ver docs/entrega/documentacion-tecnica.md)
npm run db:schema           # crea las 15 tablas
npm run dev                 # API en http://localhost:3000

cd ../frontend
node build.js               # genera las páginas
npx http-server -p 5500 -c-1 .   # sitio en http://localhost:5500
```

## Pruebas
```bash
cd backend
npm test                    # 1269 pruebas automáticas (Jest + Supertest)
npm run test:coverage       # cobertura (~92 % de sentencias, 93 % de líneas)
npm run lint                # revisión de estilo (ESLint)
```
GitHub Actions corre el lint, las pruebas y la auditoría de dependencias y secretos en cada cambio.

## Estructura
```
/frontend   sitio estático: páginas HTML (generadas por build.js), scripts JS, CSS, imágenes e i18n
/backend    API REST: src/routes, src/middleware, src/validators, src/services, sql/schema.sql y scripts/
/docs       documentos de la entrega (docs/entrega) y los scripts que los generan
README.md
```

## Despliegue
Frontend en **Netlify**, API en **Render**, base de datos en **Supabase** (PostgreSQL con seguridad por fila activa en las 15 tablas). Las variables de entorno están descritas en `backend/.env.example`; los valores reales nunca se guardan en el repositorio.

## Documentación de la entrega
Documento final, manual de usuario, documentación técnica, planificación y diseño de la base de datos y evidencia de pruebas están en [`docs/entrega/`](docs/entrega); el índice [`INDICE-ENTREGA.md`](docs/entrega/INDICE-ENTREGA.md) dice dónde está cada cosa.
