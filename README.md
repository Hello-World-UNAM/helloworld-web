# Club Hello World — Sitio Web Oficial

Sitio web oficial del Club Hello World, la comunidad de tecnologia de alto rendimiento de la FES Aragon, UNAM. Construido con [Astro](https://astro.build) y un sistema de diseno fiel a los estandares del club.

> Proyecto ganador del 1er Hackaton Interno del Club Hello World.  
> Migrado de HTML/CSS/JS estatico a Astro para mejorar modularidad y rendimiento.

---

## Indice

1. [Descripcion del Proyecto](#1-descripcion-del-proyecto)
2. [Tecnologias](#2-tecnologias)
3. [Requisitos Previos](#3-requisitos-previos)
4. [Instalacion y Uso](#4-instalacion-y-uso)
5. [Estructura del Proyecto](#5-estructura-del-proyecto)
6. [Paginas y Funcionalidad](#6-paginas-y-funcionalidad)
7. [Decisiones Tecnicas](#7-decisiones-tecnicas)
8. [Licencia](#8-licencia)

---

## 1. Descripcion del Proyecto

El sitio web del Club Hello World es una aplicacion web estatica multi-pagina que sirve como presencia digital del club universitario. Presenta la oferta de eventos y hackathones, un sistema de ranking de miembros, un formulario de registro y la informacion institucional del club.

El diseno sigue una estetica caracterizada por:

- Bordes solidos de 4px con sombras de offset visible
- Color primario `#6225e6` (morado profundo) con acento `#c4b5fd` (lavanda)
- Tipografia bold en mayusculas con alto contraste
- Composiciones visuales superpuestas y asimetricas
- Animaciones controladas por scroll (IntersectionObserver)

---

## 2. Tecnologias

| Categoria       | Tecnologia                                |
|-----------------|-------------------------------------------|
| Framework       | Astro 5.x                                 |
| Lenguajes       | HTML, CSS, JavaScript                     |
| Tipografia      | Google Fonts (Archivo Black, Space Grotesk)|
| Formularios     | Formspree                                 |
| Verificacion    | Google reCAPTCHA v3                       |
| Control de Versiones | Git + GitHub                         |

---

## 3. Requisitos Previos

- [Node.js](https://nodejs.org) version 18 o superior
- [npm](https://www.npmjs.com) (incluido con Node.js)

---

## 4. Instalacion y Uso

Clonar el repositorio:

```bash
git clone git@github.com:Hello-World-UNAM/helloworld-web.git
cd helloworld-web
```

Instalar dependencias:

```bash
npm install
```

Iniciar el servidor de desarrollo:

```bash
npm run dev
```

## 5. Estructura del Proyecto

```
helloworld-web/
|
|-- public/
|   |-- img/                    Imagenes del sitio
|       |-- equipo.jpg          Fotografia grupal del club
|       |-- logoclub2.jpeg      Logo oficial del club
|       |-- favicon.svg         Icono del sitio
|       |-- ana/sebas/cano/eric.jpeg   Fotos mesa directiva
|
|-- src/
|   |-- components/
|   |   |-- Header.astro        Navegacion principal
|   |   |-- Footer.astro        Pie de pagina con redes sociales
|   |
|   |-- data/
|   |   |-- club.json           Datos institucionales del club
|   |   |-- events.json         Catalogo de eventos y hackathones
|   |   |-- ranking.json        Tabla de clasificacion de miembros
|   |
|   |-- layouts/
|   |   |-- Layout.astro        Layout base (head, meta, fuentes)
|   |
|   |-- pages/
|   |   |-- index.astro         Pagina de inicio (Hero + Terminal)
|   |   |-- oferta.astro        Oferta de eventos del club
|   |   |-- ranking.astro       Ranking y clasificacion de miembros
|   |   |-- unete.astro         Formulario de registro
|   |   |-- nuestro-club.astro  Mision, vision y mesa directiva
|   |
|   |-- styles/
|       |-- global.css          Estilos globales del sitio
|
|-- astro.config.mjs            Configuracion de Astro
|-- package.json                Dependencias y scripts
|-- tsconfig.json               Configuracion de TypeScript
```

---

## 6. Paginas y Funcionalidad

### 6.1 Inicio (index.astro)

Pagina principal del sitio con dos secciones diferenciadas:

**Hero Section**
- Titulo principal con tipografia Archivo Black y resaltado Neo-Brutalista.
- Descripcion institucional alineada a la mision y vision del club.
- Botones de llamada a la accion (Aplica Ahora / Ver Oferta).
- Composicion visual con dos fotografias superpuestas en formato 16:9.
- Indicador de scroll animado para guiar al usuario hacia la siguiente seccion.

**Terminal Showcase**
- Consola animada con efecto typewriter (escritura caracter por caracter).
- Simula una sesion de shell mostrando informacion del club.
- La animacion se activa unicamente cuando el usuario hace scroll y la seccion entra en el viewport (IntersectionObserver).
- 4 tarjetas de estadisticas con contadores animados activados por scroll.

### 6.2 Oferta (oferta.astro)

Muestra la oferta del club dividida en tres categorias: Hackathones, Cursos y Eventos.
- Carruseles horizontales con desplazamiento suave (scroll-snap).
- Tarjetas con navegacion por botones.
- Apertura de enlaces externos via atributos `data-url`.

### 6.3 Ranking (ranking.astro)

Sistema de clasificacion de miembros del club.
- Podio visual para los 3 primeros lugares con barras de progreso animadas.
- Tabla extendida para el resto de participantes.
- Datos cargados desde `ranking.json`.

### 6.4 Unite (unete.astro)

Formulario de registro para nuevos miembros.
- Campos: nombre completo, correo institucional y motivo de interes.
- Validacion con Google reCAPTCHA v3 antes del envio.
- Envio asincrono a Formspree sin recargar la pagina.

### 6.5 Nuestro Club (nuestro-club.astro)

Pagina institucional con cuatro secciones:
- Mision y sus tres pilares (Alto Rendimiento, Habilidades Tecnicas, Impacto Profesional).
- Vision y sus tres pilares (Excelencia Tecnica, Crecimiento Integral, Proyeccion Nacional).
- Objetivos especificos del club.
- Mesa Directiva con fotografias y cargos.

---

## 7. Decisiones Tecnicas

### 7.1 Migracion a Astro

El proyecto original fue desarrollado como un sitio estatico multi-pagina con HTML, CSS y JavaScript vanilla. Se migro a Astro para obtener:

- **Componentes reutilizables**: Header y Footer compartidos sin duplicar markup.
- **Layouts centralizados**: Metadatos, fuentes y estilos globales definidos una sola vez.
- **Datos estructurados**: Archivos JSON separados para eventos, ranking y datos del club.
- **Mejor rendimiento**: Astro genera HTML estatico sin enviar JavaScript innecesario al cliente.

### 7.2 Estética

El diseno adopta:

- Bordes solidos de 4px en negro (`#000`) para todos los contenedores interactivos.
- Sombras con offset plano en el color primario.
- Tipografia en mayusculas y pesos altos (800-900) para jerarquia visual.
- Fondos de alto contraste entre secciones.

### 7.3 Animaciones bajo demanda

Todas las animaciones interactivas se activan exclusivamente cuando el elemento entra en el viewport del usuario mediante IntersectionObserver. Esto evita reproducir animaciones fuera de la vista y mejora tanto el rendimiento como la experiencia de usuario.

### 7.4 HTML semantico y accesibilidad

- Elementos semanticos de HTML5: `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`.
- Atributos `aria-label` en controles de navegacion y elementos interactivos.
- Jerarquia de encabezados correcta con un `<h1>` unico por pagina.
- Atributo `rel="noopener noreferrer"` en enlaces externos con `target="_blank"`.

---

## 8. Licencia

Este proyecto esta licenciado bajo la [Licencia MIT](LICENSE).

---

*Documentacion generada para el sitio web oficial del Club Hello World. Temporada 2026-2027.*
