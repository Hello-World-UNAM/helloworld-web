import { e as createAstro, f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, h as addAttribute, m as maybeRenderHead, p as Fragment, u as unescapeHTML, n as renderHead, o as renderSlot } from './astro/server_SrH9OeBg.mjs';
import 'piccolore';
import 'clsx';
/* empty css                            */

const $$Astro$3 = createAstro("https://clubhelloworld.com");
const $$Index$1 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$Index$1;
  const propsStr = JSON.stringify(Astro2.props);
  const paramsStr = JSON.stringify(Astro2.params);
  return renderTemplate`${renderComponent($$result, "vercel-analytics", "vercel-analytics", { "data-props": propsStr, "data-params": paramsStr, "data-pathname": Astro2.url.pathname })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/node_modules/@vercel/analytics/dist/astro/index.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/node_modules/@vercel/analytics/dist/astro/index.astro", void 0);

const $$Astro$2 = createAstro("https://clubhelloworld.com");
const $$Index = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Index;
  const propsStr = JSON.stringify(Astro2.props);
  const paramsStr = JSON.stringify(Astro2.params);
  return renderTemplate`${renderComponent($$result, "vercel-speed-insights", "vercel-speed-insights", { "data-props": propsStr, "data-params": paramsStr, "data-pathname": Astro2.url.pathname })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/node_modules/@vercel/speed-insights/dist/astro/index.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/node_modules/@vercel/speed-insights/dist/astro/index.astro", void 0);

var __freeze$1 = Object.freeze;
var __defProp$1 = Object.defineProperty;
var __template$1 = (cooked, raw) => __freeze$1(__defProp$1(cooked, "raw", { value: __freeze$1(cooked.slice()) }));
var _a$1;
const $$Astro$1 = createAstro("https://clubhelloworld.com");
const $$Header = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Header;
  const { activeNav = "" } = Astro2.props;
  const navItems = [
    { href: "/", label: "Inicio", key: "inicio" },
    { href: "/nuestro-club", label: "Sobre nosotros", key: "nuestro-club" },
    { href: "/ranking", label: "Leaderboard", key: "ranking" },
    { href: "/contacto", label: "Contacto", key: "contacto" },
    { href: "/seleccion", label: "Selecci\xF3n", key: "seleccion" }
  ];
  return renderTemplate(_a$1 || (_a$1 = __template$1(["", `<header> <div class="content"> <div class="menu container"> <a href="/" class="logo"> <img src="/img/favicon.png" alt="Logo Club Hello World" width="28" height="28">
Hello <span>World</span> </a> <input type="checkbox" id="menu" hidden> <label for="menu" class="hamburger" aria-label="Abrir men\xFA de navegaci\xF3n" hidden> <svg viewBox="0 0 32 32" width="45" height="45"> <path class="line line-top-bottom" d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"></path> <path class="line" d="M7 16 27 16"></path> </svg> </label> <nav class="navbar" aria-label="Men\xFA principal"> <!--
          Script inline s\xEDncrono: lee cach\xE9 localStorage ANTES del paint.
          Si \xFAltima visita = abierto \u2192 reordena Selecci\xF3n a posici\xF3n 2 + muestra dot.
          Esto evita parpadeo en visitas repetidas (el caso m\xE1s com\xFAn).
        --> <script>
          (function () {
            try {
              if (localStorage.getItem('hw-sel-open') !== 'true') return;
              // Marker que el async script lee para saber que ya hicimos reorder optimista
              document.documentElement.dataset.hwSelOpenCached = '1';
            } catch (_) {}
          })();
        <\/script> <ul id="nav-list"> `, ` </ul> <!-- Aplicar reorder optimista ANTES del paint si cache dice abierto --> <script>
          (function () {
            if (document.documentElement.dataset.hwSelOpenCached !== '1') return;
            var list = document.getElementById('nav-list');
            if (!list) return;
            var seleccionLi = list.querySelector('li[data-nav-key="seleccion"]');
            var inicioLi    = list.querySelector('li[data-nav-key="inicio"]');
            if (!seleccionLi || !inicioLi) return;
            inicioLi.insertAdjacentElement('afterend', seleccionLi);
            var dot = seleccionLi.querySelector('.nav-seleccion-dot');
            if (dot) dot.style.display = '';
          })();
        <\/script> </nav> </div> </div> </header> `, ""])), maybeRenderHead(), navItems.map((item) => renderTemplate`<li${addAttribute(item.key, "data-nav-key")}> <a${addAttribute(item.href, "href")}${addAttribute(activeNav === item.key ? "nav-active" : "", "class")}> ${item.label} ${item.key === "seleccion" && renderTemplate`<span class="nav-seleccion-dot" aria-label="Convocatoria abierta" style="display:none;"></span>`} </a> </li>`), renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/components/Header.astro?astro&type=script&index=0&lang.ts"));
}, "/home/sebs/Documents/GitHub/helloworld-web/src/components/Header.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Footer = createComponent(async ($$result, $$props, $$slots) => {
  const socialLinks = [
    {
      href: "https://www.instagram.com/helloworld_unam/",
      label: "Instagram del club",
      bgColor: "#a855f7",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 22 22" fill="white">
      <path d="M21.94 6.47C21.89 5.3 21.7 4.5 21.43 3.8C21.15 3.06 20.72 2.4 20.16 1.85C19.61 1.29 18.94 0.86 18.21 0.58C17.51 0.31 16.71 0.12 15.54 0.07C14.36 0.01 13.99 0 11 0C8.02 0 7.64 0.01 6.47 0.06C5.3 0.12 4.5 0.31 3.8 0.58C3.06 0.86 2.4 1.28 1.85 1.85C1.29 2.4 0.86 3.06 0.58 3.79C0.31 4.5 0.12 5.29 0.07 6.46C0.01 7.64 0 8.02 0 11C0 13.99 0.01 14.36 0.06 15.54C0.12 16.71 0.31 17.51 0.58 18.21C0.86 18.94 1.29 19.61 1.85 20.16C2.4 20.72 3.06 21.15 3.79 21.42C4.5 21.69 5.29 21.88 6.46 21.94C7.64 21.99 8.01 22 11 22C13.98 22 14.36 21.99 15.53 21.94C16.7 21.88 17.5 21.7 18.2 21.42C18.93 21.14 19.6 20.71 20.15 20.15C20.7 19.6 21.14 18.94 21.42 18.21C21.69 17.5 21.88 16.71 21.93 15.54C21.98 14.36 22 13.99 22 11C22 8.02 21.99 7.64 21.94 6.47ZM11 16.65C7.88 16.65 5.35 14.12 5.35 11C5.35 7.88 7.88 5.35 11 5.35C14.12 5.35 16.65 7.88 16.65 11C16.65 14.12 14.12 16.65 11 16.65ZM16.88 5.13C16.15 5.13 15.56 4.54 15.56 3.81C15.56 3.08 16.15 2.49 16.88 2.49C17.61 2.49 18.2 3.08 18.2 3.81C18.2 4.54 17.61 5.13 16.88 5.13ZM11 7.34C8.98 7.34 7.34 8.98 7.34 11C7.34 13.03 8.98 14.67 11 14.67C13.03 14.67 14.67 13.03 14.67 11C14.67 8.98 13.03 7.34 11 7.34Z"/>
    </svg>`
    },
    {
      href: "https://github.com/Hello-World-UNAM",
      label: "GitHub del club",
      bgColor: "#000",
      icon: `<svg height="22" width="22" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.17 6.839 9.481.5.092.683-.217.683-.481 0-.237-.009-.866-.013-1.699-2.782.603-3.37-1.338-3.37-1.338-.454-1.15-1.11-1.458-1.11-1.458-.906-.619.069-.606.069-.606 1.002.071 1.527 1.03 1.527 1.03.89 1.529 2.34 1.087 2.911.831.091-.645.348-1.087.634-1.338-2.22-.252-4.555-1.11-4.555-4.94 0-1.09.39-1.986 1.028-2.682-.103-.252-.446-1.268.098-2.642 0 0 .837-.268 2.75 1.024a9.563 9.563 0 012.496-.335 9.58 9.58 0 012.496.335c1.913-1.292 2.75-1.024 2.75-1.024.544 1.374.202 2.39.1 2.642.64.696 1.027 1.592 1.027 2.682 0 3.839-2.338 4.685-4.567 4.933.358.309.678.916.678 1.847 0 1.334-.012 2.412-.012 2.74 0 .267.18.577.688.481A12.01 12.01 0 0022 12c0-5.523-4.477-10-10-10z"/>
    </svg>`
    },
    {
      href: "https://www.linkedin.com/in/hello-world-5243573b5/",
      label: "LinkedIn del club",
      bgColor: "#3b82f6",
      icon: `<svg height="22" width="22" viewBox="0 0 24 24" fill="white">
      <path d="M20,2H4C2.9,2,2,2.9,2,4v16c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2zM8.5,19H6V10h2.5V19zM7.3,9h-0.1C6.4,9,6,8.6,6,8.1V7.9c0-0.5,0.4-0.9,0.9-0.9h0.1C7.6,7,8,7.4,8,7.9v0.1C8,8.6,7.6,9,7.3,9zM19,19h-2.5v-4.9c0-1.2-0.4-2-1.4-2c-0.8,0-1.3,0.6-1.5,1.2h-0.1V19H10V10h2.3v1.3h0C12.7,10.7,14,9.9,15.5,9.9c2.1,0,3.5,1.4,3.5,3.8V19z"/>
    </svg>`
    }
  ];
  return renderTemplate(_a || (_a = __template(["", '<footer class="site-footer"> <div class="footer-inner"> <!-- Columna izquierda: Brand + Sociales --> <div class="footer-col footer-col-brand"> <div class="footer-logo-row"> <a href="/" aria-label="Ir al inicio"> <img src="/img/logo.png" alt="Hello World Logo" width="56" height="56" loading="lazy"> </a> <div> <div class="footer-name">Hello <span>World</span></div> <span class="footer-tagline">Comunidad \xB7 Competencia \xB7 Crecimiento</span> </div> </div> <div class="footer-socials"> ', ` </div> </div> <!-- Columna central: Links r\xE1pidos --> <!-- Orden default = "cerrado" (Selecci\xF3n al final). JS reordena si cache=abierto. --> <div class="footer-col footer-col-nav"> <h4 class="footer-heading">Navegaci\xF3n</h4> <!-- Reorder optimista pre-paint si cache dice abierto --> <script>
        (function () {
          try {
            if (localStorage.getItem('hw-sel-open') === 'true') {
              document.documentElement.dataset.hwSelOpenCached = '1';
            }
          } catch (_) {}
        })();
      <\/script> <nav class="footer-nav" id="footer-nav"> <a href="/" data-foot-key="inicio">Inicio</a> <a href="/nuestro-club" data-foot-key="nuestro-club">Sobre Nosotros</a> <a href="/ranking" data-foot-key="ranking">Leaderboard</a> <a href="/contacto" data-foot-key="contacto">Contacto</a> <a href="/seleccion" data-foot-key="seleccion">Selecci\xF3n</a> </nav> <script>
        (function () {
          if (document.documentElement.dataset.hwSelOpenCached !== '1') return;
          var nav = document.getElementById('footer-nav');
          if (!nav) return;
          var sel    = nav.querySelector('[data-foot-key="seleccion"]');
          var inicio = nav.querySelector('[data-foot-key="inicio"]');
          if (sel && inicio) inicio.insertAdjacentElement('afterend', sel);
        })();
      <\/script> </div> <!-- Columna derecha: Instituciones --> <div class="footer-col footer-col-inst"> <h4 class="footer-heading">Instituciones</h4> <a href="https://www.aragon.unam.mx/fes-aragon/#!/inicio" target="_blank" rel="noopener noreferrer" class="footer-fes-link" aria-label="Sitio web FES Arag\xF3n"> <img src="/img/fes_aragon_logo.png" alt="FES Arag\xF3n UNAM" width="80" height="80" loading="lazy"> </a> </div> </div> <!-- Copyright --> <p class="footer-copy">\xA9 2026 Hello World University Technology Club</p> </footer> `, ""])), maybeRenderHead(), socialLinks.map((social) => renderTemplate`<a${addAttribute(social.href, "href")} target="_blank" rel="noopener noreferrer"${addAttribute(social.label, "aria-label")} class="social-btn"${addAttribute(`background-color: ${social.bgColor};`, "style")}> ${renderComponent($$result, "Fragment", Fragment, {}, { "default": async ($$result2) => renderTemplate`${unescapeHTML(social.icon)}` })} </a>`), renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/components/Footer.astro?astro&type=script&index=0&lang.ts"));
}, "/home/sebs/Documents/GitHub/helloworld-web/src/components/Footer.astro", void 0);

const $$Astro = createAstro("https://clubhelloworld.com");
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const {
    title,
    description = "Club Hello World \u2014 Comunidad tecnol\xF3gica de \xE9lite en la FES Arag\xF3n, UNAM. Hackathones, cursos y competencias de programaci\xF3n.",
    activeNav = ""
  } = Astro2.props;
  return renderTemplate`<html lang="es"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description"${addAttribute(description, "content")}><meta name="theme-color" content="#6225e6"><link rel="icon" href="/img/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"><title>${title}</title>${renderComponent($$result, "Analytics", $$Index$1, {})}${renderComponent($$result, "SpeedInsights", $$Index, {})}${renderHead()}</head> <body> ${renderComponent($$result, "Header", $$Header, { "activeNav": activeNav })} <main aria-label="Contenido principal"> ${renderSlot($$result, $$slots["default"])} </main> ${renderComponent($$result, "Footer", $$Footer, {})} </body></html>`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/layouts/Layout.astro", void 0);

export { $$Layout as $ };
