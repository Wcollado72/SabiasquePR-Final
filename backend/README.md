# Backend — Sabías que PR

> Documentación general, estructura del repositorio e instrucciones de todo el proyecto: [`../README.md`](../README.md).

API en Node.js + Express, conectada a la base de datos Postgres del proyecto de Supabase.

## Configuración inicial

```bash
cd backend
npm install
cp .env.example .env
```

Edita `.env` y reemplaza `TU_PASSWORD` en `DATABASE_URL` con la contraseña real
de la base de datos (la que generó Supabase al crear el proyecto).

También necesitas `SUPABASE_URL` (Supabase dashboard → Settings → API →
Project URL) para que el backend pueda verificar las sesiones que crea
`auth.js` en el frontend contra las llaves públicas (JWKS) del proyecto —
este proyecto usa firma asimétrica (ECC P-256), no el secreto compartido
clásico, así que no hace falta guardar ningún secreto en `.env`. Sin
`SUPABASE_URL`, todas las rutas protegidas del foro devuelven 401.

`FRONTEND_ORIGIN` controla el CORS: lista de orígenes permitidos separados por
coma. En desarrollo local ya trae los valores por defecto; en producción debe
incluir la URL real de Netlify.

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

## API del foro comunitario

Todas las rutas bajo `/api/foro`. Lectura pública, escritura requiere sesión
(header `Authorization: Bearer <access_token>` del usuario de Supabase).

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/foro/posts` | No | Lista publicaciones (filtro `?categoria=`, paginado `?limit=&offset=`) |
| GET | `/api/foro/posts/:id` | No | Detalle de una publicación con sus comentarios |
| POST | `/api/foro/posts` | Sí | Crea una publicación |
| PATCH | `/api/foro/posts/:id` | Sí (dueño o admin) | Edita una publicación |
| DELETE | `/api/foro/posts/:id` | Sí (dueño o admin) | Elimina una publicación y sus comentarios |
| POST | `/api/foro/posts/:postId/comentarios` | Sí | Crea un comentario |
| DELETE | `/api/foro/comentarios/:id` | Sí (dueño o admin) | Elimina un comentario |
