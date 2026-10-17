(function(){
  var D=864e5, now=Date.now();
  function ts(ms){ return { toDate: function(){ return new Date(ms); }, __ts: ms }; }
  var store = JSON.parse(localStorage.getItem('mockstore')||'null');
  function revive(o){ if(o&&typeof o==='object'){ if(o.__ts!==undefined && Object.keys(o).length===1) return ts(o.__ts); Object.keys(o).forEach(function(k){o[k]=revive(o[k]);}); } return o; }
  if (store) store = revive(store);
  if (!store) {
    store = { site:{}, products:{}, orders:{}, team:{}, resellers:{}, leads:{}, sellers:{}, codes:{}, clients:{}, payouts:{}, stats:{}, customers:{} };
    var D2=new Date(now+5*D); var until=D2.getFullYear()+'-'+String(D2.getMonth()+1).padStart(2,'0')+'-'+String(D2.getDate()).padStart(2,'0');
    store.site.main={brand:{name:'El Galpón',tagline:'Precio de depósito para que ganes vos'},contact:{whatsapp:'5491100000000',zone:'zona sur/oeste',address:'Av. Ejemplo 1234',area:'Laferrere',hours:'Lunes a viernes de 9 a 17',payments:'Transferencia o efectivo',changes:'7 días'},settings:{minOrder:30000,examplePrices:true},captions:{depA:'Nuestro depósito',depB:'Mercadería en stock',depC:'Pedidos listos'},images:{hero:'img/hero.jpg',depA:'img/deposito-1.jpg',depB:'img/deposito-2.jpg',depC:'img/deposito-3.jpg'},
      categories:['Tappers','Vasos plásticos','Vasos de vidrio','Tablas de cortar','Frascos de vidrio','Blanquería','Tecno económica'],brands:[],
      shipping:{enabled:true,zones:[{name:'La Matanza',cost:3500,eta:'24 a 48 hs'},{name:'Lomas y Lanús',cost:4500,eta:'48 hs'}],note:'Entregamos martes y viernes.'},
      loyalty:{enabled:true,per:1000,rewards:[{pts:50,label:'$3.000 de descuento'},{pts:200,label:'$15.000 de descuento'}],raffle:{enabled:true,every:20000,prize:'Combo de bazar valuado en $50.000'}},payments:{enabled:true,mode:'sena',pct:30,when:'confirmado'},notify:{auto:true},
      trust:{showNumbers:true,minShow:10,baseOrders:0,baseClients:0,video:'https://youtube.com/shorts/dQw4w9WgXcQ'},tiers:{enabled:true,days:90,levels:[{name:'Bronce',min:0,shipOff:0,ptsMult:1,perk:'Sumás puntos en cada compra'},{name:'Plata',min:50000,shipOff:50,ptsMult:1.25,perk:'Te avisamos primero de las ofertas'},{name:'Oro',min:400000,shipOff:100,ptsMult:1.5,perk:'Prioridad en el armado'}]}};
    store.site.counters={delivered:128,clients:47,places:15,since:'2026-08',top:['p03','p01','p04','p02'],at:now};
    [['p01','Juego de sábanas 2 plazas','Blanquería',14500,22000,'img/sabanas.jpg','ok'],['p02','Auriculares bluetooth','Tecno económica',8000,14000,'img/ollas.jpg','order'],['p03','Frascos herméticos x3','Frascos de vidrio',5400,8900,'img/frascos.jpg','ok'],['p04','Copas x6','Vasos de vidrio',9800,15500,'img/copas.jpg','ok']].forEach(function(r,i){ store.products[r[0]]={sku:(i===0?'BLA-SAB-2P':i===2?'FRA-HER-3':''),name:r[1],cat:r[2],price:r[3],sug:r[4],img:r[5],stock:r[6],leadDays:r[6]==='order'?10:0,featured:true,order:i+1,qty:(i===0?12:i===2?6:null),minQty:(i===0?5:i===2?8:0)}; if(i===2) store.products[r[0]].stock='low'; });
    store.sellers.MARTA={name:'Marta Gómez',phone:'1123456789',zone:'Feria Laferrere',recruitedBy:'',since:now-40*D,active:true,email:'marta@test.com'};
    store.sellers.JORGE={name:'Jorge Pérez',phone:'1155554444',zone:'La Salada',recruitedBy:'MARTA',since:now-10*D,active:true,email:''};
    store.codes.MARTA={name:'Marta',active:true}; store.codes.JORGE={name:'Jorge',active:true};
    store.team['marta@test.com']={role:'seller',sellerCode:'MARTA'};
    store.customers={'u-rosa':{name:'Rosa Feriante',phone:'1199998888',barrio:'Feria Laferrere',ref:'MARTA',email:'rosa@test.com',createdAt:ts(now-20*D),points:20,tier:{amount:84700,level:'Plata',at:now},month:{key:(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')),amount:19600}}};
    store.clients={'1199998888':{seller:'MARTA',last:now-15*D,name:'Rosa Feriante',barrio:'Feria Laferrere',points:20,month:{key:(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')),amount:19600}},'1133334444':{name:'Carla Díaz',barrio:'La Salada',points:140,month:{key:(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')),amount:80000}}};
    store.orders.o1={code:'K3F9A',name:'Rosa Feriante',barrio:'Feria Laferrere',phone:'1199998888',uid:'u-rosa',items:[{id:'p01',name:'Juego de sábanas 2 plazas',sku:'BLA-SAB-2P',q:3,price:14500,cat:'Blanquería'},{id:'p03',name:'Frascos herméticos x3',sku:'FRA-HER-3',q:4,price:5400,cat:'Frascos de vidrio'}],total:65100,shipping:3500,grand:68600,delivery:{mode:'envio',zone:'La Matanza',address:'Calle 123',cost:3500,eta:'24 a 48 hs'},ref:'MARTA',sellerCode:'MARTA',status:'confirmado',createdAt:ts(now-2*D)};
    store.orders.o2={code:'P8QZ2',name:'Rosa Feriante',barrio:'Feria Laferrere',phone:'1199998888',uid:'u-rosa',items:[{id:'p04',name:'Copas x6',sku:'',q:2,price:9800,cat:'Vasos de vidrio'}],total:19600,shipping:0,grand:19600,delivery:{mode:'retiro'},ref:'MARTA',sellerCode:'MARTA',status:'entregado',createdAt:ts(now-15*D)};
    store.leads.l1={type:'vendedor',name:'Carlos Ruiz',phone:'1166667777',zone:'Feria Isidro Casanova',kind:'Ya vendo o recorro ferias',ref:'MARTA',status:'nuevo',createdAt:ts(now-3600e3)};
  }
  function save(){ localStorage.setItem('mockstore', JSON.stringify(store)); }
  function clone(d){ return revive(JSON.parse(JSON.stringify(d))); }
  function snap(id,data){ return { id:id, exists: data!==undefined, data:function(){ return data===undefined?undefined:clone(data); } }; }
  function setPath(o,path,v){ var ps=path.split('.'); for(var i=0;i<ps.length-1;i++){ if(o[ps[i]]==null) o[ps[i]]={}; o=o[ps[i]]; } o[ps[ps.length-1]]=v; }
  function apply(target,d){ Object.keys(d).forEach(function(k){ var v=d[k]; if(v&&v.__inc!==undefined){ var cur=(target[k]||0); target[k]=cur+v.__inc; } else if(k.indexOf('.')!==-1) setPath(target,k,v); else target[k]=v; }); }
  var idc=0; window.__writes=[];
  function coll(name, filters){
    store[name]=store[name]||{}; filters=filters||[];
    var c = {
      doc:function(id){ id=id||('auto'+(++idc)+'xyzab'+Math.random().toString(36).slice(2,6)); return {
        id:id,
        get:function(){ return Promise.resolve(snap(id,store[name][id])); },
        set:function(d,opt){ var base = opt&&opt.merge ? (store[name][id]||{}) : {}; var t=Object.assign({},base); apply(t,d); store[name][id]=t; window.__writes.push([name,id,'set']); save(); return Promise.resolve(); },
        update:function(d){ if(!store[name][id]) return Promise.reject({code:'not-found'}); apply(store[name][id],d); window.__writes.push([name,id,'update']); save(); return Promise.resolve(); },
        delete:function(){ delete store[name][id]; save(); return Promise.resolve(); }
      };},
      add:function(d){ return c.doc().set(d); },
      where:function(f,op,v){ return coll(name, filters.concat([[f,v]])); },
      orderBy:function(){ return c; }, limit:function(){ return c; },
      get:function(){ var ids=Object.keys(store[name]).filter(function(i){ return filters.every(function(fl){ return store[name][i][fl[0]]===fl[1]; }); });
        var docs=ids.map(function(i){return snap(i,store[name][i]);});
        if(name==='orders'||name==='payouts') docs.sort(function(a,b){ var x=a.data().createdAt, y=b.data().createdAt; return (y?y.toDate():0)-(x?x.toDate():0);});
        if(name==='products') docs.sort(function(a,b){return (a.data().order||0)-(b.data().order||0);});
        return Promise.resolve({ empty:!docs.length, docs:docs }); }
    };
    return c;
  }
  var db = { collection:function(n){ return coll(n); }, batch:function(){ var ops=[]; return { set:function(ref,d,o){ops.push(function(){return ref.set(d,o);});}, update:function(ref,d){ops.push(function(){return ref.update(d);});}, commit:function(){ ops.forEach(function(f){f();}); return Promise.resolve(); } }; } };
  var q=location.search;
  var who = q.indexOf('admin=1')!==-1 ? 'alexgoldenstein@hotmail.com' : q.indexOf('seller=1')!==-1 ? 'marta@test.com' : q.indexOf('client=1')!==-1 ? 'rosa@test.com' : q.indexOf('newclient=1')!==-1 ? 'nuevo@test.com' : null;
  var names={'marta@test.com':'Marta Gómez','alexgoldenstein@hotmail.com':'Alex Goldenstein','rosa@test.com':'Rosa Feriante','nuevo@test.com':''};
  var userObj = who ? { uid:'u-'+who.split('@')[0], email:who, emailVerified: q.indexOf('unverified=1')===-1, displayName: names[who], reload:function(){return Promise.resolve();}, getIdToken:function(){return Promise.resolve('x');}, sendEmailVerification:function(){return Promise.resolve();}, updateProfile:function(){return Promise.resolve();} } : null;
  var authCb=null;
  function mkUser(em){ return { uid:'u-'+em.split('@')[0], email:em, emailVerified:false, displayName:'', reload:function(){return Promise.resolve();}, getIdToken:function(){return Promise.resolve('x');}, sendEmailVerification:function(){return Promise.resolve();}, updateProfile:function(p){ this.displayName=p.displayName; return Promise.resolve();} }; }
  var auth = { currentUser:null, onAuthStateChanged:function(cb){ authCb=cb; auth.currentUser=userObj; setTimeout(function(){cb(userObj);},10); }, getRedirectResult:function(){return Promise.resolve();},
    signOut:function(){ auth.currentUser=null; setTimeout(function(){authCb(null);},5); return Promise.resolve();},
    createUserWithEmailAndPassword:function(em){ var u=mkUser(em); auth.currentUser=u; setTimeout(function(){authCb(u);},5); return Promise.resolve({user:u}); },
    signInWithEmailAndPassword:function(em){ var u=mkUser(em); u.emailVerified=true; auth.currentUser=u; setTimeout(function(){authCb(u);},5); return Promise.resolve({user:u}); } };
  function firestoreFn(){ return db; } firestoreFn.FieldValue = { serverTimestamp:function(){ return ts(Date.now()); }, increment:function(n){ return {__inc:n}; } };
  function authFn(){ return auth; } authFn.GoogleAuthProvider=function(){ this.setCustomParameters=function(){}; };
  if(!localStorage.getItem('mockstore')) save();
  window.firebase = { initializeApp:function(){}, auth:authFn, firestore:firestoreFn, storage:function(){ return { ref:function(){ return { put:function(){return Promise.reject();}, getDownloadURL:function(){} }; } }; } };
})();
