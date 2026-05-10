# DESIGN.md — Club Hello World
> Sistema de diseño vivo. Actualizar cuando cambie cualquier decisión de estética.

---

## Filosofía

**Neo-Brutalism.** Bordes duros, sombras flat, tipografía agresiva, colores sin miedo. Nada de border-radius en elementos funcionales (excepción: avatares, terminal). Sin gradientes decorativos. Sin sombras suaves. El peso visual lo hacen los bordes y las sombras de offset.

El club es serio y competitivo, pero también humano. El diseño debe sentirse poderoso sin ser frío.

---

## Paleta de Colores

| Token | Valor | Uso |
|---|---|---|
| Purple (primario) | `#6225e6` | Header bg, botones primarios, borders activos, sombras de cards, icons |
| Lavender (acento) | `#c4b5fd` | Badges, hover shadows de btn-primary, cursor terminal |
| Dark purple (texto) | `#2d002e` | Nombres de miembros, bio text |
| Deep purple (cards) | `#4e006a` | Sombra de cards en oferta |
| Soft purple bg | `#f9f3ff` | Fondo de secciones main (`club-main`, `seleccion-main`, items `objetivo`) |
| Light purple | `#f0e6ff` | Fondo del bloque `objetivo-general` |
| Black | `#000` | Bordes, sombras, texto principal |
| White | `#fff` | Fondos de cards, texto sobre purple |
| Green status | `#4ade80` | Dot de selección abierta (nav), terminal output |
| Yellow accent | `#fbbf24` | Flip card socials, tape de polaroids |
| Text body | `#444` / `#555` | Párrafos dentro de cards |
| Text muted | `#666` / `#777` / `#888` | Subtítulos, hints, labels secundarios |

**Nunca usar** colores fuera de esta paleta sin actualizar este doc.

---

## Tipografía

### Familias
| Familia | Variable | Uso |
|---|---|---|
| **DM Sans** | Sans-serif | UI, labels, botones, todo texto funcional |
| **Playfair Display** | Serif | Quotes, declaraciones, momentos de énfasis elegante |
| **Courier New** | Monospace | Terminal, números de stats |

Ambas fuentes se cargan desde Google Fonts en `Layout.astro`.

### Escala de pesos
- `300` — raro, solo texto de apoyo muy suave
- `500 / 600` — body normal, subtítulos
- `700` — fuerte, headings de segunda jerarquía
- `800` — labels uppercase, nav, botones
- `900` — títulos principales, hero, h2 de cards

### Reglas de texto
- **Uppercase obligatorio en**: títulos hero, labels de sección, badges, botones, nav
- **Letter-spacing**: 0.04–0.12em en texto uppercase; 1–3px en títulos grandes
- **Line-height**: 1.1 en títulos, 1.5–1.8 en body
- **Tamaños hero**: `clamp(3rem, 5vw, 4.5rem)` para h2 principal de index
- **h1 de contact-hero**: `2.8rem, 900 weight, uppercase, letter-spacing: 3px`
- **h2 de section-card**: `1.4rem, 700 weight, color: #6225e6`

---

## Bordes

```css
/* Containers interactivos (cards, formularios) */
border: 4px solid #000;

/* Elementos medianos (flip cards, items de lista) */
border: 3px solid #000;

/* Elementos pequeños (icon-boxes, tags, checkboxes) */
border: 2px solid #000;

/* Divisores de sección (header, footer, section-hero) */
border-bottom: 4px solid #6225e6;   /* header bottom */
border-top: 4px solid #000;          /* footer top */
box-shadow: 0 -5px 0 #6225e6;       /* footer purple line */
```

**Ningún elemento usa `border-radius`** excepto: avatares de directiva (50%), terminal block (10px), nav dots (50%).

---

## Sombras (Box Shadows)

Todas las sombras son **flat offset** (estilo neo-brutalist). Cero blur.

| Contexto | Valor |
|---|---|
| Cards grandes (section-card, contact-form) | `8px 8px 0 #6225e6` |
| Hover de cards grandes | `12px 12px 0 #6225e6` |
| Cards medianas (contact-card, stat-card) | `6px-8px 6px-8px 0 #6225e6` |
| CTA section | `10px 10px 0 #6225e6` |
| Icon-boxes | `3px 3px 0 #000` |
| Badges | `4px 4px 0 #000` |
| Botón primario | `6px 6px 0 #000` → hover `9px 9px 0 #c4b5fd` |
| Botón secundario | `6px 6px 0 #6225e6` → hover `9px 9px 0 #6225e6` |
| Nav items activos/hover | `3px 3px 0 #000` |
| Elementos desactivados | sombra en `#ccc` |

---

## Interacciones (Hover)

**Cards interactivas**: `transform: translate(-3px, -3px)` + sombra aumentada  
**Botones**: `transform: translate(-3px, -3px)` + sombra más grande/color diferente  
**Social buttons**: `transform: translate(-2px, -2px)`  
**Transition**: siempre `0.15s–0.2s ease`

---

## Componentes Clave

### `.hw-badge`
```css
background: #c4b5fd; color: #000;
border: 3px solid #000; box-shadow: 4px 4px 0 #000;
font-weight: 800; text-transform: uppercase; font-size: 0.85rem;
transform: rotate(-2deg);  /* siempre ligeramente torcido */
```
Variantes de color: `sel-badge-open` (verde suave), `sel-badge-closed` (gris).

### `.hw-btn-primary` / `.hw-btn-secondary`
```css
/* primary */
background: #6225e6; color: #fff;
border: 4px solid #000; box-shadow: 6px 6px 0 #000;
font-weight: 800; text-transform: uppercase; font-size: 1.1rem;

/* secondary */
background: #fff; color: #000;
box-shadow: 6px 6px 0 #6225e6;
```

### `.section-card`
Contenedor blanco estándar para bloques de contenido:
```css
background: #fff;
border: 4px solid #000;
box-shadow: 8px 8px 0 #6225e6;
padding: 32px 36px;
margin-bottom: 32px;
```
El `h2` dentro lleva `color: #6225e6` + icono-box (ver abajo).

### `.icon` (dentro de `section-card h2`)
Caja cuadrada 36×36px con icono:
```css
background: #6225e6; color: #fff;
width: 36px; height: 36px;
border: 2px solid #000; box-shadow: 3px 3px 0 #000;
display: inline-flex; align-items: center; justify-content: center;
font-size: 1.1rem;
```

### `.cta-section`
Bloque de cierre de página:
```css
background: #fff;
background-image: radial-gradient(rgba(0,0,0,0.1) 2px, transparent 2px);
background-size: 20px 20px;
border: 4px solid #000; box-shadow: 10px 10px 0 #6225e6;
padding: 48px 36px; text-align: center;
```
h2: `2rem, 900, uppercase`. p: `1.15rem, 700, max-width 600px`.

### `.mv-declaracion`
Blockquote para declaraciones de misión/filosofía:
```css
font-family: "Playfair Display", serif;
font-size: 1.15rem; font-weight: 700; font-style: italic;
border-left: 5px solid #6225e6;
padding: 10px 0 10px 18px;
```

### `.objetivo-general-block p`
Bloque de statement con fondo destacado:
```css
background: #f0e6ff;
border: 3px solid black; box-shadow: 6px 6px 0 #6225e6;
padding: 24px; text-align: center;
/* Esquina decorativa con ✦ púrpura via ::before */
```

---

## Estructura de Páginas

### Hero de secciones internas
Todas las páginas secundarias (contacto, nuestro-club, selección) usan `.contact-hero`:
```css
background: #6225e6; padding: 60px 20px 50px; text-align: center;
h1: white, 2.8rem, 900, uppercase, letter-spacing 3px
p: rgba(255,255,255,0.95), max-width 520px
```
Se permiten badges y botones en el hero de selección.

### Main content
Secciones con fondo `#f9f3ff`. Container `max-width: 900px` para páginas de contenido simple.

### Fondo de puntos (dot pattern)
Dos variantes usadas en el site:
1. **Purple dots** (`hw-showcase`): `radial-gradient(#6225e622 1.5px, transparent 1.5px)`, size `22px 22px`
2. **Dark dots** (`cta-section`): `radial-gradient(rgba(0,0,0,0.1) 2px, transparent 2px)`, size `20px 20px`

### Elemento decorativo `✦`
Estrella de 4 puntas usada como:
- Separador en badges (`✦ ABIERTO · 2026-2027`)
- Esquina decorativa del bloque `objetivo-general`
- Elemento giratorio en hero de index (`.hw-deco-star`, `animation: spin-slow 8s linear`)

---

## Animaciones

**Regla de oro**: Todas las animaciones de scroll usan `IntersectionObserver`. **Nunca autoplay al cargar.**

| Animación | Dónde | Trigger |
|---|---|---|
| Typewriter terminal | index | Scroll (IntersectionObserver) |
| Stat counters | index | Scroll (IntersectionObserver) |
| Progress bars | ranking | Scroll (IntersectionObserver) |
| Polaroid scatter | nuestro-club | Scroll JS manual |
| Flip cards | nuestro-club | Click |
| Dot nav pulse | Selección abierta | CSS infinite |
| Spin star | Hero index | CSS infinite |

---

## Patrones de Icono

El site usa dos librerías:
- **Bootstrap Icons** (`bi bi-*`) vía CDN — preferencia general
- **Lucide Icons** (inline SVG) — nuestro-club, hero index

Para iconos dentro de `section-card h2`: usar la clase `.icon` con `set:html` para Lucide, o `<i class="bi ...">` para Bootstrap Icons.

---

## Grids Recurrentes

| Contexto | Columnas | Gap |
|---|---|---|
| Hero index | 1fr 1fr | 40px |
| Terminal + Stats | 1.15fr 0.85fr | 44px |
| Objetivos específicos | 1fr 1fr | 16px |
| Pilares misión/visión | repeat(3, 1fr) | 12px |
| Directiva | repeat(2, 1fr) | 16px |
| Stats (index) | 1fr 1fr | 18px |
| Contact layout | 1.2fr 0.8fr | 36px |
| Footer | 1.2fr auto auto | 40px |

---

## Qué NO hacer

- ❌ `border-radius` en cards, botones, contenedores
- ❌ Sombras con blur (`box-shadow: 0 4px 8px rgba(...)`)
- ❌ Gradientes de color en backgrounds de sección
- ❌ Colores fuera de la paleta definida
- ❌ Animaciones que se disparan al cargar (sin scroll trigger)
- ❌ Tipografía sin `font-family: "DM Sans"` en UI (el browser default es sans-serif genérico)
- ❌ Secciones flotantes sin el wrapper `section-card` en páginas de contenido
- ❌ Elementos negros full-width que no existen en ninguna otra página (rompen consistencia)
- ❌ Usar `Playfair Display` para texto UI funcional (solo para quotes/énfasis)
