'use strict';
// La tienda pública nunca escribe en el catálogo; lee catalogo.json.
// Pages CMS guarda ediciones en GitHub y GitHub Pages las publica.
(()=>{
const CART_KEY='dayams_cart_github_v1';
const fallbackFAQ=[{question:'¿Cómo compro?',answer:'Elige tus prendas, agrégalas al carrito y envía tu pedido por WhatsApp. Confirmaremos la disponibilidad antes del pago.'},{question:'¿Cómo pago?',answer:'El pago es exclusivo por Yape. Te enviaremos el número o QR por WhatsApp cuando confirmemos tu pedido.'},{question:'¿Hacen envíos a Lima y provincias?',answer:'Sí. Coordinamos el costo, la agencia y el tiempo estimado de entrega por WhatsApp antes del pago.'},{question:'¿Qué pasa si una talla se agota?',answer:'Las existencias se confirman por WhatsApp. El carrito no reserva prendas automáticamente.'}];
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={catalog:null,cart:[],category:'Todas',search:'',sort:'featured',activeModal:null,focusBefore:null};
const num=(value,otherwise=0)=>Number.isFinite(Number(value))?Number(value):otherwise;
const stock=p=>Math.max(0,Math.floor(num(p.stock)));
const itemId=p=>String(p.id||p.name||'');
const cleanPhone=n=>String(n||'').replace(/\D/g,'');
const money=n=>`S/ ${num(n).toFixed(2)}`;
function imageURL(path){
  const raw=String(path||'').trim();if(!raw)return '';
  if(/^https:\/\//i.test(raw))return raw;
  if(/^(?:\/)?(?:images|media)\//i.test(raw)){
    const file=raw.replace(/^\/+/, '');
    try{return new URL(file,document.baseURI).href}catch{return ''}
  }
  // Acepta archivos locales del repositorio y URLs relativas; no permite javascript: ni data:.
  if(/^(?!\/|\.|\\)(?:[\w%\-]+\/)*[\w%.\-]+\.(?:jpe?g|png|webp|gif|avif|svg)$/i.test(raw)){
    try{return new URL(raw,document.baseURI).href}catch{return ''}
  }
  return '';
}
function validUrl(url){try{const u=new URL(String(url||''));return u.protocol==='https:'?u.href:''}catch{return ''}}
function toast(message){$('toastRoot').textContent=message;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toastRoot').textContent='',3800)}
function products(){return state.catalog?.products||[]}
function getProduct(id){return products().find(p=>itemId(p)===String(id))}
function parseCSV(value){return Array.isArray(value)?value.map(x=>String(x).trim()).filter(Boolean):String(value||'').split(',').map(x=>x.trim()).filter(Boolean)}
function initCart(){try{const arr=JSON.parse(localStorage.getItem(CART_KEY)||'[]');state.cart=Array.isArray(arr)?arr.filter(x=>x&&typeof x.id==='string'&&Number.isInteger(x.qty)&&x.qty>0).slice(0,100):[]}catch{state.cart=[]}}
function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(state.cart))}catch{toast('Tu navegador no permitió guardar la bolsa. Puedes seguir comprando en esta sesión.')}updateBadge()}
function totalUnits(){return state.cart.reduce((a,c)=>a+c.qty,0)}
function eligible(){const min=Math.max(2,num(state.catalog?.settings?.wholesale_min,4));return state.catalog?.settings?.wholesale_enabled!==false&&totalUnits()>=min}
function unitPrice(item){const p=getProduct(item.id);return !p?0:(eligible()&&num(p.wholesale)>0?num(p.wholesale):num(p.price))}
function cartTotal(){return state.cart.reduce((acc,item)=>acc+unitPrice(item)*item.qty,0)}
function usedStock(id){return state.cart.filter(item=>item.id===id).reduce((n,item)=>n+item.qty,0)}
function reconcileCart(){
  const totals={};state.cart=state.cart.filter(c=>{
    const p=getProduct(c.id);if(!p||p.active===false||stock(p)===0)return false;
    const sizes=parseCSV(p.sizes),colors=parseCSV(p.colors);
    if(!sizes.includes(c.size)||!colors.includes(c.color))return false;
    const limit=stock(p)-(totals[c.id]||0);
    if(limit<=0)return false;
    c.qty=Math.min(c.qty,limit);totals[c.id]=(totals[c.id]||0)+c.qty;return true;
  });saveCart();
}
function updateBadge(){const qty=totalUnits();$('cartBadge').textContent=qty;$('floatCount').textContent=qty;}
function art(p,cls=''){
  const path=imageURL(p.image);const name=esc(p.name);
  if(path)return `<img class="${cls}" src="${esc(path)}" alt="${name}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.hidden=false;"><div class="noimage" hidden>dayams<br><small>FOTO NO DISPONIBLE</small></div>`;
  return `<div class="noimage">dayams<br><small>YOUR LOOK, YOUR RULES</small></div>`;
}
function featured(){let arr=products().filter(p=>p.active!==false);if(state.category!=='Todas')arr=arr.filter(p=>(p.category||'Otros')===state.category);const term=state.search.trim().toLocaleLowerCase('es');if(term)arr=arr.filter(p=>[p.name,p.description,p.category].some(k=>String(k||'').toLocaleLowerCase('es').includes(term)));if(state.sort==='low')arr.sort((a,b)=>num(a.price)-num(b.price));if(state.sort==='high')arr.sort((a,b)=>num(b.price)-num(a.price));if(state.sort==='new')arr.reverse();return arr}
function renderFilters(){const categories=['Todas',...new Set(products().filter(p=>p.active!==false).map(p=>String(p.category||'Otros')))];if(!categories.includes(state.category))state.category='Todas';$('categoryFilters').innerHTML=categories.map(c=>`<button type="button" class="chip ${state.category===c?'active':''}" data-category="${esc(c)}" aria-pressed="${state.category===c}">${esc(c)}</button>`).join('')}
function renderProducts(){const list=featured();$('productCounter').textContent=list.length;const area=$('productsGrid');area.innerHTML=list.length?list.map(p=>{
    const remain=stock(p),low=remain>0&&remain<=3;
    return `<article class="product-card" data-product-id="${esc(itemId(p))}"><div class="product-art">${art(p)}<span class="label-pill ${remain?'':'soldout-label'}">${esc(remain?String(p.badge||'DAYAMS'):'Agotado')}</span></div><div class="product-content"><span class="product-type">${esc(p.category||'DAYAMS')}</span><h3 class="product-name">${esc(p.name)}</h3><div class="product-bottom"><div><div class="product-price">${money(p.price)}</div><div class="product-stock ${low?'low':''}">${!remain?'Sin existencias':low?'¡Últimas unidades!':(num(p.wholesale)>0?'Precio por mayor disponible':'Disponible')}</div></div><button type="button" class="product-view" data-view="${esc(itemId(p))}" aria-label="Ver ${esc(p.name)}" ${remain?'':'disabled'}>↗</button></div></div></article>`;
  }).join(''):'<div class="empty-products">No encontramos prendas con esos filtros. Prueba otra categoría o búsqueda. ♡</div>';}
function applyCatalog(data){
  if(!data||!data.settings||!Array.isArray(data.products))throw new Error('El catálogo no tiene un formato válido');
  const ids=new Set();const cleaned=data.products.map(p=>{
    if(!p||typeof p!=='object')return null;
    const id=itemId(p);if(!id||ids.has(id))return null;ids.add(id);
    return {...p,id,name:String(p.name||'Prenda sin nombre'),stock:stock(p),price:Math.max(0,num(p.price)),wholesale:Math.max(0,num(p.wholesale)),sizes:parseCSV(p.sizes),colors:parseCSV(p.colors)};
  }).filter(Boolean);
  state.catalog={...data,products:cleaned};
  reconcileCart();renderStatic();renderFilters();renderProducts();$('loading').classList.add('hidden');
}
function renderStatic(){const s=state.catalog.settings;document.title=`${String(s.brand||'DAYAMS')} · Boutique`;
  $('announcement').textContent=s.announcement||'DAYAMS ✦ Envíos a todo el Perú';$('heroLabel').textContent=s.hero_label||'NUEVA TEMPORADA';
  $('heroTitle').innerHTML=esc(s.hero_title||'Tu estilo, tu universo.').replace(/,\s*/,'<br><em>')+(String(s.hero_title||'').includes(',')?'</em>':'');
  $('heroSub').textContent=s.hero_subtitle||'';$('catalogDesc').textContent=s.catalog_subtitle||'';$('aboutText').textContent=s.about||'';$('footerText').textContent=s.footer||'';
  const ticker=String(s.ticker||'DAYAMS ✦ STYLE YOUR STORY ✦ ');$('tickerTrack').textContent=(ticker+'  ').repeat(15);
  $('demoWarning').classList.toggle('hidden',s.demo!==true);
  const heroPic=imageURL(s.hero_image);if(heroPic){$('heroPicture').innerHTML=`<img src="${esc(heroPic)}" alt="Colección DAYAMS" onerror="this.style.display='none';">`}
  const wa=cleanPhone(s.whatsapp),waHref=wa?'https://wa.me/'+wa:'';$('footerWA').href=waHref||'#coleccion';$('aboutWA').href=waHref||'#coleccion';
  $('socialLinks').innerHTML=['instagram','tiktok','facebook'].filter(key=>validUrl(s[key])).map(key=>`<a href="${esc(validUrl(s[key]))}" target="_blank" rel="noopener noreferrer">${key.charAt(0).toUpperCase()+key.slice(1)} ↗</a>`).join('');
  $('navSocial').href=validUrl(s.instagram)||waHref||'#nosotras';
  $('reviewsGrid').innerHTML=(state.catalog.reviews||[]).filter(r=>r&&r.published===true&&r.name&&r.text).map(r=>`<article class="review-card"><div class="stars" aria-label="5 estrellas">★★★★★</div><p>“${esc(r.text)}”</p><small>— ${esc(r.name)}</small></article>`).join('')||'<p class="lead">Pronto compartiremos experiencias de clientas con su autorización.</p>';
  $('faqList').innerHTML=(state.catalog.faq||[]).filter(f=>f&&f.question&&f.answer).concat((state.catalog.faq||[]).length?[]:fallbackFAQ).map(f=>`<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('');
}
function openModal(html,type='detail'){state.focusBefore=document.activeElement;state.activeModal=type;$('modalRoot').innerHTML=`<div class="overlay" id="modalOverlay"><div class="dialog ${type==='cart'?'cart-dialog':''}" role="dialog" aria-modal="true" aria-label="${type==='cart'?'Mi bolsa':'Detalle de prenda'}">${html}</div></div>`;document.body.classList.add('modal-open');$('modalRoot').querySelector('.close')?.focus()}
function closeModal(){state.activeModal=null;$('modalRoot').innerHTML='';document.body.classList.remove('modal-open');if(state.focusBefore?.isConnected)state.focusBefore.focus()}
function showProduct(id){const p=getProduct(id);if(!p||!stock(p))return;const sizes=parseCSV(p.sizes),colors=parseCSV(p.colors);if(!sizes.length||!colors.length){toast('Consulta tallas y colores por WhatsApp');return}
  const photos=[p.image,...(Array.isArray(p.gallery)?p.gallery:[])].filter(x=>imageURL(x));
  const gallery=photos.length>1?`<div class="detail-thumbnails" aria-label="Más fotografías">${photos.map((x,i)=>`<button type="button" class="detail-thumb ${i===0?'active':''}" data-gallery="${esc(imageURL(x))}" aria-label="Ver fotografía ${i+1}"><img src="${esc(imageURL(x))}" alt="Vista ${i+1} de ${esc(p.name)}" loading="lazy"></button>`).join('')}</div>`:'';
  openModal(`<div class="dialog-top"><span class="eyebrow">DETALLE DE PRENDA</span><button type="button" class="close" data-close aria-label="Cerrar">×</button></div><div class="detail-layout"><div><div class="detail-art">${art(p)}</div>${gallery}</div><div class="detail-text"><span class="product-type">${esc(p.category||'DAYAMS')}</span><h2>${esc(p.name)}</h2><div class="detail-price">${money(p.price)}</div><p>${esc(p.description||'Prenda de la colección DAYAMS.')}</p>${num(p.wholesale)>0?`<p>Por mayor: <b>${money(p.wholesale)}</b> c/u desde ${Math.max(2,num(state.catalog.settings.wholesale_min,4))} prendas en la bolsa.</p>`:''}<div class="fieldgroup"><label for="chosenSize">Talla</label><select class="field" id="chosenSize">${sizes.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div><div class="fieldgroup"><span>Color</span><div class="swatch-picks">${colors.map((c,i)=>`<label class="swatch-pick"><input type="radio" name="chosenColor" value="${esc(c)}" ${i===0?'checked':''}><span>${esc(c)}</span></label>`).join('')}</div></div><div class="fieldgroup"><label for="chosenQty">Cantidad</label><input type="number" class="field" id="chosenQty" min="1" max="${stock(p)}" value="1" inputmode="numeric"></div><p id="availableStock" class="product-stock">${stock(p)} disponibles en total · sujeto a confirmación</p><button type="button" id="addToCart" class="btn btn-primary btn-wide" data-add="${esc(id)}">Agregar a mi bolsa ♡</button></div></div>`)
}
function addToCart(id){const p=getProduct(id),size=$('chosenSize')?.value,color=document.querySelector('input[name="chosenColor"]:checked')?.value,qty=Number($('chosenQty')?.value);if(!p||!size||!color||!Number.isInteger(qty)||qty<1){toast('Selecciona una cantidad válida');return}if(usedStock(id)+qty>stock(p)){toast('No hay suficientes unidades disponibles');return}
  const prev=state.cart.find(c=>c.id===id&&c.size===size&&c.color===color);if(prev)prev.qty+=qty;else state.cart.push({id,size,color,qty});saveCart();closeModal();toast('¡Prenda agregada a tu bolsa! ♡')}
function lineThumb(p){const path=imageURL(p?.image);return path?`<img class="cart-thumb" src="${esc(path)}" alt="${esc(p.name)}" onerror="this.style.display='none'">`:'<div class="cart-thumb cart-placeholder">✦</div>'}
function showCart(){openModal(`<div class="dialog-top"><h2>Mi bolsa <span style="color:var(--rose)">♡</span></h2><button type="button" class="close" data-close aria-label="Cerrar">×</button></div><div id="cartLines"></div><div class="cart-summary"><strong>Total</strong><b id="cartTotal">S/ 0.00</b></div><p class="cart-small" id="discountNote"></p><div class="cart-fields"><div class="fieldgroup"><label for="buyerName">Tu nombre</label><input id="buyerName" class="field" maxlength="80" placeholder="¿Cómo te llamas?" autocomplete="name" required></div><div class="fieldgroup"><label for="buyerCity">Ciudad / distrito</label><input id="buyerCity" class="field" maxlength="100" placeholder="Ej. Lima, San Isidro" required></div><div class="fieldgroup"><label for="buyerNotes">Comentario (opcional)</label><textarea id="buyerNotes" class="field" rows="2" maxlength="400" placeholder="Entrega, dirección de referencia o consulta"></textarea></div></div><div class="checkout-info">El total no incluye delivery. Confirmaremos stock, envío y datos para pagar exclusivamente con <b>Yape</b> por WhatsApp. El pedido no se reserva hasta la confirmación.</div><button id="sendWhatsApp" class="btn btn-primary btn-wide" type="button">Enviar pedido por WhatsApp ↗</button>`, 'cart');renderCart()}
function renderCart(){if(state.activeModal!=='cart')return;const content=$('cartLines');content.innerHTML=state.cart.length?state.cart.map((c,i)=>{
  const p=getProduct(c.id);if(!p)return '';return `<div class="cart-line">${lineThumb(p)}<div class="cart-line-main"><b>${esc(p.name)}</b><small>Talla ${esc(c.size)} · ${esc(c.color)} · ${money(unitPrice(c))} c/u</small><button class="remove" data-remove="${i}" type="button">Eliminar</button></div><div class="qty"><button type="button" data-decrease="${i}" aria-label="Restar una unidad">−</button><span>${c.qty}</span><button type="button" data-increase="${i}" aria-label="Agregar una unidad" ${usedStock(c.id)>=stock(p)?'disabled':''}>+</button></div></div>`}).join(''):'<div class="empty-products">Tu bolsa está vacía. Descubre tu próximo look. ✦</div>';
  $('cartTotal').textContent=money(cartTotal());$('sendWhatsApp').disabled=!state.cart.length;
  const s=state.catalog.settings;$('discountNote').textContent=eligible()?'♡ Se aplicó el precio por mayor a las prendas que tienen ese precio configurado.':(s.wholesale_enabled===false?'':`Agrega ${Math.max(0,Math.max(2,num(s.wholesale_min,4))-totalUnits())} prenda(s) más para acceder a precios por mayor, donde estén disponibles.`);
}
function adjust(index,delta){const c=state.cart[index];if(!c)return;const p=getProduct(c.id);if(delta>0&&usedStock(c.id)>=stock(p)){toast('No hay más unidades disponibles');return}c.qty+=delta;if(c.qty<=0)state.cart.splice(index,1);saveCart();renderCart()}
function buildWhatsAppURL(name,city,notes=''){
  const phone=cleanPhone(state.catalog?.settings?.whatsapp);
  if(phone.length<10||phone.length>15)return '';
  const lines=state.cart.map(c=>{const p=getProduct(c.id);return `• ${p.name} | talla ${c.size} | color ${c.color} | ${c.qty} × ${money(unitPrice(c))} = ${money(unitPrice(c)*c.qty)}`});
  const msg=`Hola, DAYAMS 💖 Quiero consultar y confirmar este pedido:\n\n${lines.join('\n')}\n\nTotal de prendas: ${money(cartTotal())}${eligible()?' (precio por mayor aplicado)':''}\nNombre: ${name}\nCiudad/distrito: ${city}${notes?'\nComentario: '+notes:''}\n\nPor favor, confírmenme la disponibilidad y el costo del envío. Deseo pagar por Yape cuando me proporcionen el número o QR. ¡Gracias!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
function checkout(){if(!state.cart.length)return;
  const name=String($('buyerName').value||'').trim(),city=String($('buyerCity').value||'').trim(),notes=String($('buyerNotes').value||'').trim();if(!name||!city){toast('Escribe tu nombre y tu ciudad antes de enviar el pedido');if(!name)$('buyerName').focus();else $('buyerCity').focus();return}
  const url=buildWhatsAppURL(name,city,notes);if(!url){toast('El WhatsApp de la tienda aún no está bien configurado');return}
  // En móvil navega directamente: no depende de ventanas emergentes bloqueables.
  window.location.assign(url);
}
function connectEvents(){
  $('cartButton').addEventListener('click',showCart);$('floatingCart').addEventListener('click',showCart);
  $('productSearch').addEventListener('input',e=>{state.search=e.target.value;renderProducts()});$('productSort').addEventListener('change',e=>{state.sort=e.target.value;renderProducts()});
  $('categoryFilters').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;state.category=button.dataset.category;renderFilters();renderProducts()});
  $('productsGrid').addEventListener('click',e=>{const button=e.target.closest('[data-view]');if(button)showProduct(button.dataset.view)});
  $('modalRoot').addEventListener('click',e=>{
    if(e.target.id==='modalOverlay'||e.target.closest('[data-close]'))return closeModal();
    const thumb=e.target.closest('[data-gallery]');if(thumb){
      const image=$('modalRoot').querySelector('.detail-art img');if(image){image.src=thumb.dataset.gallery;image.style.display='block'}
      $('modalRoot').querySelectorAll('[data-gallery]').forEach(b=>b.classList.toggle('active',b===thumb));return;
    }
    const add=e.target.closest('[data-add]');if(add)return addToCart(add.dataset.add);
    const remove=e.target.closest('[data-remove]');if(remove){state.cart.splice(Number(remove.dataset.remove),1);saveCart();renderCart();return}
    const inc=e.target.closest('[data-increase]');if(inc)return adjust(Number(inc.dataset.increase),1);
    const dec=e.target.closest('[data-decrease]');if(dec)return adjust(Number(dec.dataset.decrease),-1);
    if(e.target.id==='sendWhatsApp')checkout();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.activeModal)closeModal();if(e.key==='Tab'&&state.activeModal){const dialog=$('modalRoot').querySelector('.dialog'),focusable=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(el=>el.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  // Efectos 3D progresivos: no afectan la funcionalidad ni se activan si se pide reducir movimiento.
  if(matchMedia('(pointer:fine) and (prefers-reduced-motion:no-preference)').matches){const stage=$('heroStage');stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;stage.style.setProperty('--ry',`${(x*9).toFixed(2)}deg`);stage.style.setProperty('--rx',`${(-y*8).toFixed(2)}deg`)});stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--ry','0deg');stage.style.setProperty('--rx','0deg')})}
}
async function loadCatalog(){
  try{
    const result=await fetch(`catalogo.json?v=${Date.now()}`,{cache:'no-store'});
    if(!result.ok)throw new Error('No se pudo descargar catálogo (HTTP '+result.status+')');
    const data=await result.json();applyCatalog(data);
    try{localStorage.setItem('dayams_last_catalog',JSON.stringify(data))}catch{}
  }catch(error){
    let cached;try{cached=JSON.parse(localStorage.getItem('dayams_last_catalog')||'null')}catch{}
    if(cached){try{applyCatalog(cached);$('connectionWarning').textContent='No se pudo conectar para actualizar las prendas. Mostramos la última versión guardada en este dispositivo; confirma disponibilidad por WhatsApp.';$('connectionWarning').classList.remove('hidden');return}catch{}}
    $('loading').classList.add('hidden');$('productsGrid').innerHTML='<div class="empty-products">No pudimos cargar la colección. Comprueba tu conexión o vuelve a intentar. ♡</div>';
    $('connectionWarning').textContent='Error al cargar el catálogo. Esta tienda debe abrirse desde una web publicada o un servidor local, no haciendo doble clic en index.html.';$('connectionWarning').classList.remove('hidden');
    console.error('DAYAMS catálogo:',error);
  }
}
function start(){initCart();connectEvents();$('year').textContent=new Date().getFullYear();loadCatalog()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
// Pruebas automatizadas locales (no exponen contraseñas ni edición).
window.__DAYAMS_TEST__={get state(){return state},applyCatalog,addToCart,getProduct,usedStock,eligible,unitPrice,cartTotal,imageURL,buildWhatsAppURL,showCart,showProduct};
})();
