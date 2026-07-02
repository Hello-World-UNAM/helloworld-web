import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_Dze4DMNY.mjs';
import { manifest } from './manifest_BkaUTGHA.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/admin/auth/callback.astro.mjs');
const _page2 = () => import('./pages/admin/entrevistas.astro.mjs');
const _page3 = () => import('./pages/admin/leaderboard.astro.mjs');
const _page4 = () => import('./pages/admin/login.astro.mjs');
const _page5 = () => import('./pages/admin/miembros.astro.mjs');
const _page6 = () => import('./pages/admin/periodos.astro.mjs');
const _page7 = () => import('./pages/admin/seleccion-config.astro.mjs');
const _page8 = () => import('./pages/admin/solicitudes/detalle.astro.mjs');
const _page9 = () => import('./pages/admin/solicitudes.astro.mjs');
const _page10 = () => import('./pages/admin.astro.mjs');
const _page11 = () => import('./pages/api/auth/callback.astro.mjs');
const _page12 = () => import('./pages/api/cron/daily-digest.astro.mjs');
const _page13 = () => import('./pages/api/send-rejection.astro.mjs');
const _page14 = () => import('./pages/contacto.astro.mjs');
const _page15 = () => import('./pages/mi-cuenta/login.astro.mjs');
const _page16 = () => import('./pages/mi-cuenta/registrar.astro.mjs');
const _page17 = () => import('./pages/mi-cuenta.astro.mjs');
const _page18 = () => import('./pages/nuestro-club.astro.mjs');
const _page19 = () => import('./pages/oferta.astro.mjs');
const _page20 = () => import('./pages/ranking.astro.mjs');
const _page21 = () => import('./pages/seleccion/agendar.astro.mjs');
const _page22 = () => import('./pages/seleccion/aplicar.astro.mjs');
const _page23 = () => import('./pages/seleccion.astro.mjs');
const _page24 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/admin/auth/callback.astro", _page1],
    ["src/pages/admin/entrevistas.astro", _page2],
    ["src/pages/admin/leaderboard.astro", _page3],
    ["src/pages/admin/login.astro", _page4],
    ["src/pages/admin/miembros.astro", _page5],
    ["src/pages/admin/periodos.astro", _page6],
    ["src/pages/admin/seleccion-config.astro", _page7],
    ["src/pages/admin/solicitudes/detalle.astro", _page8],
    ["src/pages/admin/solicitudes/index.astro", _page9],
    ["src/pages/admin/index.astro", _page10],
    ["src/pages/api/auth/callback.ts", _page11],
    ["src/pages/api/cron/daily-digest.ts", _page12],
    ["src/pages/api/send-rejection.ts", _page13],
    ["src/pages/contacto.astro", _page14],
    ["src/pages/mi-cuenta/login.astro", _page15],
    ["src/pages/mi-cuenta/registrar.astro", _page16],
    ["src/pages/mi-cuenta/index.astro", _page17],
    ["src/pages/nuestro-club.astro", _page18],
    ["src/pages/oferta.astro", _page19],
    ["src/pages/ranking.astro", _page20],
    ["src/pages/seleccion/agendar.astro", _page21],
    ["src/pages/seleccion/aplicar.astro", _page22],
    ["src/pages/seleccion/index.astro", _page23],
    ["src/pages/index.astro", _page24]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "middlewareSecret": "eca3b2df-c379-4931-ad81-61862985e5b0",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
