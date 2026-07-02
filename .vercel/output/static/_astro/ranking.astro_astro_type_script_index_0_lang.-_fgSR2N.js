import{s as b}from"./supabase.ByhH4n-l.js";const k=["#c8a96e","#6eb5c8","#c86e9a"],H=[1,0,2];async function x(){const a=document.getElementById("loading-ranking"),s=document.getElementById("podium"),r=document.getElementById("ranking-list-section"),n=document.getElementById("ranking-tbody"),{data:m}=await b.from("periodos").select("nombre").eq("es_activo",!0).maybeSingle();m?.nombre;const d=document.querySelector(".ranking-title");d&&(d.textContent="Leaderboard");const{data:i,error:l}=await b.from("ranking_por_periodo").select("nombre, puntos_totales").eq("es_activo",!0).gt("puntos_totales",0).order("puntos_totales",{ascending:!1});if(a.style.display="none",l||!i||i.length===0){s.style.display="flex",s.innerHTML='<p style="text-align:center; width:100%; color:var(--color-text-muted); font-weight: 600; font-size: 1.1rem; padding: 2rem 0;">No hay puntos registrados en esta temporada.</p>';return}function h(t){if(t==="Jesús Sebastián Vázquez Zarco")return"Sebastián Vázquez";const e=t.trim().split(/\s+/);return e.length<=2?t:e.length===3?`${e[0]} ${e[1]}`:`${e[0]} ${e[2]}`}const g=i.map(t=>({name:h(t.nombre),pts:t.puntos_totales})),f=g[0].pts,y=t=>Math.round(t/f*100),o=new Map;g.forEach(t=>{o.has(t.pts)||o.set(t.pts,[]),o.get(t.pts).push(t)});const u=Array.from(o.keys()).sort((t,e)=>e-t),v=[0,1,2].map(t=>{const e=u[t];return e===void 0?null:{rank:t+1,pts:e,participants:o.get(e)}});s.style.display="flex",s.innerHTML=H.map(t=>{const e=v[t];if(!e)return"";const p=k[t];return`
      <div class="podium-card rank-${e.rank}">
        <div class="podium-medal">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${p}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="${p}" opacity="0.2"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
        </div>
        <div class="podium-pos">#${e.rank}</div>
        <div class="podium-name">${e.participants.map(w=>w.name).join(" & ")}</div>
        <div class="podium-pts">${e.pts} <span>pts</span></div>
        <div class="pts-bar-wrap">
          <div class="pts-bar" style="width: 0%; background-color: #22c55e;" data-pct="${y(e.pts)}"></div>
        </div>
      </div>
    `}).join("");const c=[];for(let t=3;t<u.length;t++){const e=u[t];o.get(e).forEach(p=>c.push({rank:t+1,...p}))}c.length>0&&(r.style.display="block",n.innerHTML=c.map((t,e)=>`
      <tr class="${e>=2?"extra-row":""}">
        <td class="rank-num">#${t.rank}</td>
        <td class="player-name">${t.name}</td>
        <td class="bar-cell">
          <div class="table-bar-wrap">
            <div class="table-bar" style="width: 0%; background-color: #22c55e;" data-pct="${y(t.pts)}"></div>
          </div>
        </td>
        <td class="pts-value">${t.pts} pts</td>
      </tr>
    `).join(""),c.length>2&&(document.getElementById("show-more-wrap").style.display="block",$())),setTimeout(()=>{document.querySelectorAll(".pts-bar, .table-bar").forEach(t=>{const e=t;e.style.width=e.dataset.pct+"%"})},100)}function $(){const a=document.getElementById("show-more-btn"),s=document.getElementById("table-wrap"),r=document.querySelector(".ranking-table"),n=document.querySelector("#ranking-tbody");if(a&&s&&n&&n.children.length>2){const m=r.querySelector("thead").offsetHeight,d=n.children[0].offsetHeight,i=n.children[1].offsetHeight,l=m+d+i+2;s.style.maxHeight=`${l}px`,a.addEventListener("click",()=>{s.classList.contains("table-collapsed")?(s.style.maxHeight=`${r.offsetHeight}px`,s.classList.remove("table-collapsed"),a.textContent="Ocultar miembros ▲"):(s.style.maxHeight=`${l}px`,s.classList.add("table-collapsed"),a.textContent="Ver más miembros ▼")}),window.addEventListener("resize",()=>{s.classList.contains("table-collapsed")||(s.style.maxHeight=`${r.offsetHeight}px`)})}}document.addEventListener("DOMContentLoaded",x);
