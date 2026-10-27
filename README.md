# Finance

Una app personal de gastos e inversiones. Cada pago con Apple Pay llega solo, a través de un Atajo del iPhone, se categoriza y aparece en los dashboards. Las aportaciones a la cartera se apuntan con un formulario y se valoran cada día con el precio de cierre.

- **Web**: GitHub Pages, instalable en la pantalla de inicio del iPhone.
- **Servidor y base de datos**: Supabase (PostgreSQL con seguridad por fila: cada usuario solo ve lo suyo).
- **Recepción de pagos**: función `ingest` de Supabase, a la que llama el Atajo.
- **Precios**: tarea diaria de GitHub Actions que trae el cierre de Yahoo Finance y lo pasa a euros.

## Puesta en marcha

1. En GitHub, **Settings → Secrets and variables → Actions**, crea estos secretos:

   | Secreto | Dónde está |
   | --- | --- |
   | `SUPABASE_PROJECT_REF` | El código de la dirección del proyecto en Supabase |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | Supabase → API Keys → Legacy API Keys → anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → Legacy API Keys → service_role |
   | `SUPABASE_DB_PASSWORD` | La contraseña de la base de datos del proyecto |
   | `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
   | `ANTHROPIC_API_KEY` (opcional) | Para que Claude categorice los comercios que no reconocen las reglas |

2. En **Settings → Pages**, elige **Source: GitHub Actions**.
3. En Supabase, **Authentication → Sign In / Providers → Email**, desactiva **Confirm email** (la app es solo para ti) o pon la dirección de la web en **Authentication → URL Configuration → Site URL**.
4. Cada `push` a `main` ejecuta el workflow **Desplegar**: pruebas, base de datos, función `ingest` y web.
5. Abre la web, crea tu cuenta y ve a **Ajustes** para configurar el Atajo de Apple Pay.

## El Atajo de Apple Pay

Los pasos detallados están en la pantalla **Ajustes** de la app. En resumen: una automatización de Atajos del tipo **Transacción**, que se ejecuta sola en cada pago, hace un `POST` a la función `ingest`:

```
POST https://<project-ref>.supabase.co/functions/v1/ingest
Authorization: Bearer <token generado en Ajustes>
Content-Type: application/json

{ "importe": "23,50 €", "comercio": "MERCADONA", "tarjeta": "Revolut" }
```

Solo recoge los pagos hechos con Apple Pay. iOS no deja a ninguna app leer las notificaciones de otras, así que los pagos con la tarjeta física se apuntan a mano en la app.

## Categorías

Primero se aplican las reglas que has creado al corregir una categoría, después una lista de palabras clave de comercios habituales en España y, si hay `ANTHROPIC_API_KEY`, Claude. Lo que decide Claude se guarda como regla para no volver a preguntarle por ese comercio.

## Desarrollo

```
npm install
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev
npm test
```
