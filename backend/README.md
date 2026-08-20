# Backend — Sabías que PR

API en Node.js + Express, conectada a la base de datos Postgres del proyecto de Supabase.

## Configuración inicial

```bash
cd backend
npm install
cp .env.example .env
```

Edita `.env` y reemplaza `TU_PASSWORD` en `DATABASE_URL` con la contraseña real
de la base de datos (la que generó Supabase al crear el proyecto).

## Aplicar el esquema de la base de datos

```bash
npm run db:schema
```

Crea las tablas `noticias`, `productos`, `perfiles`, `mensajes_contacto`,
`suscriptores` y `ordenes` si no existen todavía.

## Migrar el contenido actual

```bash
npm run db:migrate-content
```

Carga `_content/noticias.json` y `_content/productos.json` (los mismos que usa
`build.js` del frontend) dentro de las tablas `noticias` y `productos`.
Se puede correr varias veces sin duplicar datos.

## Levantar el servidor

```bash
npm run dev
```

Corre en `http://localhost:3000`. Prueba `GET /api/health` para confirmar que
el servidor está conectado a la base de datos.
