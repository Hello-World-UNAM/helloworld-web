# Contribuir

## Flujo de PR

1. Fork y clone.
2. Rama descriptiva: `feat/nombre-corto` o `fix/nombre-corto`.
3. `npm run build` antes de abrir el PR para asegurar que compila.
4. Abre PR contra `main`. GitHub bloquea el merge sin al menos 1 review.

## Convenciones de commit

[Conventional Commits](https://www.conventionalcommits.org) en español. Ejemplos reales del repo:

- `feat(admin): permitir cerrar/reabrir el registro de evidencias por período`
- `fix(mi-cuenta): activar botón de re-login en vista de acceso denegado`
- `refactor(admin): colapsar acciones del leaderboard en menú Configuración`
- `chore(deps): añadir resend y browser-image-compression`

## Estilo

- Sin CSS Modules, sin Tailwind. Los estilos base viven en [`src/styles/global.css`](../src/styles/global.css) alineados a [`DESIGN.md`](../DESIGN.md).
- El panel de administración (`src/pages/admin/*`) usa estilos inline por velocidad de iteración; migrarlos a `global.css` está en el roadmap.
- TypeScript `strict`. Sin `any` cuando el tipo es derivable.
- Componentes en `.astro`, lógica cliente en `<script>` con `import.meta.env` para vars públicas.

## Migraciones DB

Se aplican vía Supabase MCP o dashboard. Describir el cambio en el mensaje del commit y en el PR — qué tabla/función se toca, por qué, y si hay reversión.
