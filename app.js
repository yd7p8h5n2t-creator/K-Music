/* K-MUSIC V4 — Liquid Glass + Playlists */
const $=id=>document.getElementById(id);
const audio=$('audio'),musicInput=$('musicInput'),addMusic=$('addMusic'),addFirstMusic=$('addFirstMusic'),library=$('library'),search=$('search'),songCount=$('songCount');
const sectionLabel=$('sectionLabel'),sectionTitle=$('sectionTitle'),newPlaylistTop=$('newPlaylistTop');
const liquidTabs=$('liquidTabs'),liquidIndicator=$('liquidIndicator');
const miniPlayer=$('miniPlayer'),miniCover=$('miniCover'),miniTitle=$('miniTitle'),miniArtist=$('miniArtist'),miniPlay=$('miniPlay'),miniPrevious=$('miniPrevious'),miniNext=$('miniNext'),miniProgress=$('miniProgress'),miniEq=$('miniEq'),openPlayer=$('openPlayer');
const playerScreen=$('playerScreen'),playerBackdrop=$('playerBackdrop'),closePlayer=$('closePlayer'),coverStage=$('coverStage'),bigCover=$('bigCover'),bigTitle=$('bigTitle'),bigArtist=$('bigArtist'),bigAlbum=$('bigAlbum'),playerFavorite=$('playerFavorite'),play=$('play'),previous=$('previous'),next=$('next'),shuffle=$('shuffle'),repeat=$('repeat'),progress=$('progress'),currentTime=$('currentTime'),duration=$('duration');
const sheetBackdrop=$('sheetBackdrop'),playlistSheet=$('playlistSheet'),sheetTitle=$('sheetTitle'),sheetBody=$('sheetBody'),closeSheet=$('closeSheet');

let songs=[],playlists=[],currentSong=-1,currentView='all',activePlaylistId=null;
let shuffleEnabled=false,repeatEnabled=false,database=null,activeObjectUrl=null;

/* ---------- IndexedDB ---------- */
function openDatabase(){
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open('KMusicDatabase',2);
        request.onupgradeneeded=e=>{
            const db=e.target.result;
            if(!db.objectStoreNames.contains('songs')) db.createObjectStore('songs',{keyPath:'id'});
            if(!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists',{keyPath:'id'});
        };
        request.onsuccess=e=>{database=e.target.result;resolve(database)};
        request.onerror=()=>reject(request.error);
    });
}
function dbPut(storeName,value){
    return new Promise((resolve,reject)=>{
        const tx=database.transaction([storeName],'readwrite');
        tx.objectStore(storeName).put(value);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
    });
}
function dbDelete(storeName,id){
    return new Promise((resolve,reject)=>{
        const tx=database.transaction([storeName],'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
    });
}
function dbGetAll(storeName){
    return new Promise((resolve,reject)=>{
        const tx=database.transaction([storeName],'readonly');
        const req=tx.objectStore(storeName).getAll();
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error);
    });
}
async function init(){
    try{
        await openDatabase();
        [songs,playlists]=await Promise.all([dbGetAll('songs'),dbGetAll('playlists')]);
        render();
    }catch(e){console.error("Impossible d'ouvrir K-Music",e)}
}
init();

/* ---------- Import ---------- */
function openFilePicker(){musicInput.click()}
addMusic.addEventListener('click',openFilePicker);
addFirstMusic.addEventListener('click',openFilePicker);

musicInput.addEventListener('change',async e=>{
    for(const file of Array.from(e.target.files)){
        if(!file.type.startsWith('audio/')&&!isAudioExtension(file.name)) continue;
        const song={id:crypto.randomUUID(),name:file.name,title:removeExtension(file.name),artist:'Artiste inconnu',album:'Album inconnu',year:'',artwork:null,favorite:false,file};
        try{
            const m=await readMetadata(file);
            if(m){
                song.title=m.title||song.title;
                song.artist=m.artist||song.artist;
                song.album=m.album||song.album;
                song.year=m.year||'';
                song.artwork=m.artwork||null;
            }
        }catch{}
        await dbPut('songs',song);
        songs.push(song);
    }
    musicInput.value='';
    render();
});
function readMetadata(file){
    return new Promise(resolve=>{
        if(typeof jsmediatags==='undefined'){resolve(null);return}
        jsmediatags.read(file,{
            onSuccess:tag=>{
                const t=tag.tags||{};let artwork=null;
                if(t.picture){
                    const bytes=new Uint8Array(t.picture.data);let binary='';
                    for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
                    artwork=`data:${t.picture.format};base64,${btoa(binary)}`;
                }
                resolve({title:t.title||'',artist:t.artist||'',album:t.album||'',year:t.year||'',artwork});
            },
            onError:()=>resolve(null)
        });
    });
}

/* ---------- Liquid tabs ---------- */
const viewOrder=['all','playlists','favorites'];
function setView(view,{fromDrag=false}={}){
    if(!viewOrder.includes(view)) return;
    currentView=view;
    activePlaylistId=null;

    const idx=viewOrder.indexOf(view);
    liquidTabs.style.setProperty('--tab-index',idx);
    document.querySelectorAll('.liquid-tab').forEach(btn=>{
        const active=btn.dataset.view===view;
        btn.classList.toggle('active',active);
        btn.setAttribute('aria-selected',active?'true':'false');
    });

    search.value='';
    search.placeholder=view==='playlists'?'Rechercher une playlist…':'Titre, artiste, album…';
    render();
}
document.querySelectorAll('.liquid-tab').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));

let tabDrag=null;
liquidTabs.addEventListener('pointerdown',e=>{
    const rect=liquidTabs.getBoundingClientRect();
    tabDrag={rect,startX:e.clientX,startIndex:viewOrder.indexOf(currentView)};
    liquidTabs.classList.add('dragging');
    liquidTabs.setPointerCapture?.(e.pointerId);
});
liquidTabs.addEventListener('pointermove',e=>{
    if(!tabDrag) return;
    const inner=tabDrag.rect.width-8;
    const segment=inner/3;
    const raw=(e.clientX-tabDrag.rect.left-4)/segment-.5;
    const clamped=Math.max(0,Math.min(2,raw));
    liquidIndicator.style.transform=`translateX(${clamped*100}%)`;
});
liquidTabs.addEventListener('pointerup',e=>{
    if(!tabDrag) return;
    const segment=(tabDrag.rect.width-8)/3;
    const idx=Math.max(0,Math.min(2,Math.floor((e.clientX-tabDrag.rect.left-4)/segment)));
    tabDrag=null;
    liquidTabs.classList.remove('dragging');
    liquidIndicator.style.transform='';
    setView(viewOrder[idx],{fromDrag:true});
});
liquidTabs.addEventListener('pointercancel',()=>{
    tabDrag=null;
    liquidTabs.classList.remove('dragging');
    liquidIndicator.style.transform='';
});

/* ---------- Render ---------- */
function render(){
    newPlaylistTop.classList.toggle('hidden',currentView!=='playlists');

    if(activePlaylistId){
        renderPlaylistDetail();
        return;
    }

    if(currentView==='playlists'){
        sectionLabel.textContent='COLLECTIONS';
        sectionTitle.textContent='Mes playlists';
        songCount.textContent=`${playlists.length} ${playlists.length>1?'playlists':'playlist'}`;
        renderPlaylists();
        return;
    }

    sectionLabel.textContent=currentView==='favorites'?'SÉLECTION':'COLLECTION';
    sectionTitle.textContent=currentView==='favorites'?'Mes favoris':'Mes morceaux';

    const base=currentView==='favorites'?songs.filter(s=>s.favorite):songs;
    const q=search.value.trim().toLowerCase();
    const visible=base.filter(s=>`${s.title} ${s.artist} ${s.album}`.toLowerCase().includes(q));

    songCount.textContent=`${base.length} ${base.length>1?'morceaux':'morceau'}`;
    renderSongList(visible);
}

function renderSongList(list,playlist=null){
    library.innerHTML='';
    if(!list.length){
        const emptyTitle=songs.length===0?'Ta bibliothèque est vide':(currentView==='favorites'?'Aucun favori':'Aucun résultat');
        const emptyText=songs.length===0?'Ajoute quelques morceaux et K-Music prend vie.':(currentView==='favorites'?'Ajoute un cœur à tes morceaux préférés.':'Essaie une autre recherche.');
        library.innerHTML=`<div class="empty glass-panel"><div class="empty-cover"><div class="empty-disc">♪</div></div><h3>${emptyTitle}</h3><p>${emptyText}</p>${songs.length?'':'<button class="primary-button pressable" id="emptyAdd">Ajouter de la musique</button>'}</div>`;
        $('emptyAdd')?.addEventListener('click',openFilePicker);
        return;
    }

    list.forEach((song,i)=>{
        const index=songs.findIndex(s=>s.id===song.id);
        const el=document.createElement('article');
        el.className=`song ${index===currentSong?'is-current':''}`;
        el.style.animationDelay=`${Math.min(i*26,200)}ms`;
        el.innerHTML=`<div class="song-cover">${song.artwork?`<img src="${song.artwork}" alt="">`:'♪'}</div><div class="song-info"><div class="song-title">${escapeHTML(song.title)}</div><div class="song-artist">${escapeHTML(song.artist)}</div></div><button class="song-heart pressable ${song.favorite?'favorite':''}" aria-label="Favori">${song.favorite?'♥':'♡'}</button>`;
        el.addEventListener('click',ev=>{if(!ev.target.closest('.song-heart'))playSong(index)});
        el.querySelector('.song-heart').addEventListener('click',ev=>{ev.stopPropagation();toggleFavorite(index)});
        library.appendChild(el);
    });
}

function renderPlaylists(){
    const q=search.value.trim().toLowerCase();
    const visible=playlists.filter(p=>p.name.toLowerCase().includes(q));
    library.innerHTML='';

    const grid=document.createElement('div');
    grid.className='playlist-grid';

    const create=document.createElement('article');
    create.className='playlist-card create-playlist-card';
    create.innerHTML=`<div class="playlist-mosaic"><span class="big-plus">+</span></div><h3>Nouvelle playlist</h3><p>Créer une collection</p>`;
    create.addEventListener('click',openCreatePlaylistSheet);
    grid.appendChild(create);

    visible.forEach((playlist,i)=>{
        const card=document.createElement('article');
        card.className='playlist-card';
        card.style.animationDelay=`${Math.min(i*35,210)}ms`;
        const pSongs=playlist.songIds.map(id=>songs.find(s=>s.id===id)).filter(Boolean);
        card.innerHTML=`<div class="playlist-mosaic">${playlistMosaicHTML(pSongs)} </div><h3>${escapeHTML(playlist.name)}</h3><p>${pSongs.length} ${pSongs.length>1?'morceaux':'morceau'}</p><button class="playlist-more pressable" aria-label="Options">•••</button>`;
        card.addEventListener('click',e=>{
            if(e.target.closest('.playlist-more')) return;
            activePlaylistId=playlist.id;
            render();
        });
        card.querySelector('.playlist-more').addEventListener('click',e=>{
            e.stopPropagation();
            openPlaylistOptionsSheet(playlist.id);
        });
        grid.appendChild(card);
    });

    library.appendChild(grid);
}

function playlistMosaicHTML(pSongs){
    const arts=pSongs.filter(s=>s.artwork).slice(0,4);
    if(!arts.length) return `<div class="mosaic-empty">K</div>`;
    while(arts.length<4) arts.push(arts[arts.length-1]);
    return arts.map(s=>`<img src="${s.artwork}" alt="">`).join('');
}

function renderPlaylistDetail(){
    const playlist=playlists.find(p=>p.id===activePlaylistId);
    if(!playlist){activePlaylistId=null;render();return}
    const pSongs=playlist.songIds.map(id=>songs.find(s=>s.id===id)).filter(Boolean);
    const q=search.value.trim().toLowerCase();
    const visible=pSongs.filter(s=>`${s.title} ${s.artist} ${s.album}`.toLowerCase().includes(q));

    sectionLabel.textContent='PLAYLIST';
    sectionTitle.textContent=playlist.name;
    songCount.textContent=`${pSongs.length} ${pSongs.length>1?'morceaux':'morceau'}`;

    library.innerHTML=`<button class="back-to-playlists pressable" id="backToPlaylists">‹ Toutes les playlists</button><div class="playlist-detail-head"><div class="playlist-detail-cover">${pSongs[0]?.artwork?`<img src="${pSongs[0].artwork}" alt="">`:'K'}</div><div class="playlist-detail-copy"><h3>${escapeHTML(playlist.name)}</h3><p>${pSongs.length} ${pSongs.length>1?'morceaux':'morceau'}</p><div class="playlist-detail-actions"><button id="playlistPlay" class="pressable">▶ Lire</button><button id="playlistEdit" class="pressable">Modifier</button></div></div></div><div id="playlistSongs"></div>`;

    $('backToPlaylists').addEventListener('click',()=>{activePlaylistId=null;render()});
    $('playlistEdit').addEventListener('click',()=>openEditPlaylistSheet(playlist.id));
    $('playlistPlay').addEventListener('click',()=>{
        if(!pSongs.length)return;
        const idx=songs.findIndex(s=>s.id===pSongs[0].id);
        if(idx>=0)playSong(idx);
    });

    const host=$('playlistSongs');
    if(!visible.length){
        host.innerHTML=`<div class="empty glass-panel"><h3>Playlist vide</h3><p>Ajoute des morceaux avec “Modifier”.</p></div>`;
        return;
    }

    visible.forEach((song,i)=>{
        const idx=songs.findIndex(s=>s.id===song.id);
        const el=document.createElement('article');
        el.className=`song ${idx===currentSong?'is-current':''}`;
        el.style.animationDelay=`${Math.min(i*26,180)}ms`;
        el.innerHTML=`<div class="song-cover">${song.artwork?`<img src="${song.artwork}" alt="">`:'♪'}</div><div class="song-info"><div class="song-title">${escapeHTML(song.title)}</div><div class="song-artist">${escapeHTML(song.artist)}</div></div><button class="song-heart pressable ${song.favorite?'favorite':''}">${song.favorite?'♥':'♡'}</button>`;
        el.addEventListener('click',e=>{if(!e.target.closest('.song-heart'))playSong(idx)});
        el.querySelector('.song-heart').addEventListener('click',e=>{e.stopPropagation();toggleFavorite(idx)});
        host.appendChild(el);
    });
}

search.addEventListener('input',render);

/* ---------- Playlist sheets ---------- */
newPlaylistTop.addEventListener('click',openCreatePlaylistSheet);
closeSheet.addEventListener('click',hideSheet);
sheetBackdrop.addEventListener('click',hideSheet);

function showSheet(title,html){
    sheetTitle.textContent=title;
    sheetBody.innerHTML=html;
    sheetBackdrop.classList.add('open');
    playlistSheet.classList.add('open');
    sheetBackdrop.setAttribute('aria-hidden','false');
    playlistSheet.setAttribute('aria-hidden','false');
    document.body.classList.add('sheet-open');
}
function hideSheet(){
    sheetBackdrop.classList.remove('open');
    playlistSheet.classList.remove('open');
    sheetBackdrop.setAttribute('aria-hidden','true');
    playlistSheet.setAttribute('aria-hidden','true');
    document.body.classList.remove('sheet-open');
}
function openCreatePlaylistSheet(){
    showSheet('Nouvelle playlist',`<input id="playlistNameInput" class="playlist-name-input" maxlength="40" placeholder="Nom de la playlist" autocomplete="off"><button id="createPlaylistConfirm" class="sheet-primary pressable">Créer la playlist</button>`);
    setTimeout(()=>$('playlistNameInput')?.focus(),250);
    $('createPlaylistConfirm').addEventListener('click',async()=>{
        const name=$('playlistNameInput').value.trim();
        if(!name)return;
        const playlist={id:crypto.randomUUID(),name,songIds:[],createdAt:Date.now()};
        await dbPut('playlists',playlist);playlists.push(playlist);hideSheet();activePlaylistId=playlist.id;render();openEditPlaylistSheet(playlist.id);
    });
}
function openEditPlaylistSheet(id){
    const playlist=playlists.find(p=>p.id===id);if(!playlist)return;
    const selected=new Set(playlist.songIds);
    showSheet('Modifier la playlist',`<input id="editPlaylistName" class="playlist-name-input" maxlength="40" value="${escapeHTML(playlist.name)}"><div class="sheet-song-list" id="sheetSongList"></div><div class="sheet-actions-row"><button id="savePlaylistEdit" class="sheet-primary pressable">Enregistrer</button></div>`);
    const host=$('sheetSongList');
    if(!songs.length) host.innerHTML='<div class="empty"><p>Ajoute d’abord de la musique à ta bibliothèque.</p></div>';
    songs.forEach(song=>{
        const row=document.createElement('div');row.className=`sheet-song ${selected.has(song.id)?'selected':''}`;
        row.innerHTML=`<div class="sheet-song-cover">${song.artwork?`<img src="${song.artwork}" alt="">`:'♪'}</div><div class="sheet-song-copy"><strong>${escapeHTML(song.title)}</strong><span>${escapeHTML(song.artist)}</span></div><div class="sheet-check">✓</div>`;
        row.addEventListener('click',()=>{
            if(selected.has(song.id))selected.delete(song.id);else selected.add(song.id);
            row.classList.toggle('selected',selected.has(song.id));
        });
        host.appendChild(row);
    });
    $('savePlaylistEdit').addEventListener('click',async()=>{
        playlist.name=$('editPlaylistName').value.trim()||playlist.name;
        playlist.songIds=Array.from(selected);
        await dbPut('playlists',playlist);
        hideSheet();render();
    });
}
function openPlaylistOptionsSheet(id){
    const playlist=playlists.find(p=>p.id===id);if(!playlist)return;
    showSheet(playlist.name,`<button id="editPlaylistOption" class="sheet-primary pressable" style="margin-bottom:10px">Modifier les morceaux</button><button id="deletePlaylistOption" class="sheet-primary pressable" style="background:rgba(255,70,70,.14);color:#ff8e8e;box-shadow:none;border:1px solid rgba(255,90,90,.16)">Supprimer la playlist</button>`);
    $('editPlaylistOption').addEventListener('click',()=>openEditPlaylistSheet(id));
    $('deletePlaylistOption').addEventListener('click',async()=>{
        await dbDelete('playlists',id);
        playlists=playlists.filter(p=>p.id!==id);
        if(activePlaylistId===id)activePlaylistId=null;
        hideSheet();render();
    });
}

/* ---------- Favorites ---------- */
async function toggleFavorite(index){
    if(!songs[index])return;
    songs[index].favorite=!songs[index].favorite;
    await dbPut('songs',songs[index]);
    updateFavoriteUI();render();
}
function updateFavoriteUI(){
    if(currentSong<0||!songs[currentSong])return;
    const fav=songs[currentSong].favorite;
    playerFavorite.textContent=fav?'♥':'♡';
    playerFavorite.classList.toggle('favorite',fav);
}

/* ---------- Player ---------- */
function playSong(index){
    if(!songs[index])return;
    currentSong=index;const song=songs[index];
    if(activeObjectUrl)URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl=URL.createObjectURL(song.file);
    audio.src=activeObjectUrl;updatePlayer(song);render();
    audio.play().then(updatePlayButtons).catch(e=>console.error('Lecture impossible',e));
}
function updatePlayer(song){
    miniTitle.textContent=song.title;miniArtist.textContent=song.artist;
    bigTitle.textContent=song.title;bigArtist.textContent=song.artist;
    bigAlbum.textContent=song.album&&song.album!=='Album inconnu'?[song.album,song.year].filter(Boolean).join(' • '):'';
    if(song.artwork){
        miniCover.innerHTML=`<img src="${song.artwork}" alt="">`;bigCover.innerHTML=`<img src="${song.artwork}" alt="">`;
        playerBackdrop.style.setProperty('--player-art',`url("${song.artwork}")`);playerBackdrop.classList.add('has-art');updateDynamicColor(song.artwork);
    }else{
        miniCover.innerHTML='♪';bigCover.innerHTML='<div class="cover-placeholder"><span>K</span></div>';playerBackdrop.classList.remove('has-art');setDynamicRGB(130,78,255);
    }
    miniPlayer.classList.remove('hidden');updateFavoriteUI();updateMediaSession();
}
function togglePlay(){if(currentSong===-1)return;audio.paused?audio.play().catch(console.error):audio.pause()}
play.addEventListener('click',togglePlay);miniPlay.addEventListener('click',togglePlay);
audio.addEventListener('play',updatePlayButtons);audio.addEventListener('pause',updatePlayButtons);
function updatePlayButtons(){
    const playing=!audio.paused;
    play.innerHTML=`<span>${playing?'Ⅱ':'▶'}</span>`;miniPlay.innerHTML=`<span>${playing?'Ⅱ':'▶'}</span>`;
    miniEq.classList.toggle('paused',!playing);
    if('mediaSession'in navigator)navigator.mediaSession.playbackState=playing?'playing':'paused';
}
function nextSong(){
    if(!songs.length)return;let n;
    if(shuffleEnabled){if(songs.length===1)n=currentSong;else do{n=Math.floor(Math.random()*songs.length)}while(n===currentSong)}
    else{n=currentSong+1;if(n>=songs.length)n=0}
    playSong(n);
}
function previousSong(){
    if(!songs.length)return;
    if(audio.currentTime>3){audio.currentTime=0;return}
    let p=currentSong-1;if(p<0)p=songs.length-1;playSong(p);
}
next.addEventListener('click',nextSong);miniNext.addEventListener('click',nextSong);previous.addEventListener('click',previousSong);miniPrevious.addEventListener('click',previousSong);
audio.addEventListener('ended',()=>{if(repeatEnabled){audio.currentTime=0;audio.play();return}nextSong()});
shuffle.addEventListener('click',()=>{shuffleEnabled=!shuffleEnabled;shuffle.classList.toggle('active',shuffleEnabled)});
repeat.addEventListener('click',()=>{repeatEnabled=!repeatEnabled;repeat.classList.toggle('active',repeatEnabled)});
audio.addEventListener('loadedmetadata',()=>duration.textContent=formatTime(audio.duration));
audio.addEventListener('timeupdate',()=>{
    if(!audio.duration)return;const pct=audio.currentTime/audio.duration*100;
    progress.value=pct;progress.style.setProperty('--progress-fill',`${pct}%`);miniProgress.style.width=`${pct}%`;currentTime.textContent=formatTime(audio.currentTime);
});
progress.addEventListener('input',()=>{if(!audio.duration)return;audio.currentTime=progress.value/100*audio.duration;progress.style.setProperty('--progress-fill',`${progress.value}%`)});

/* ---------- Full player ---------- */
function openFullPlayer(){if(currentSong===-1)return;playerScreen.classList.add('open');playerScreen.setAttribute('aria-hidden','false');document.body.classList.add('player-open')}
function closeFullPlayer(){playerScreen.classList.remove('open');playerScreen.setAttribute('aria-hidden','true');document.body.classList.remove('player-open');resetCoverTilt()}
openPlayer.addEventListener('click',openFullPlayer);closePlayer.addEventListener('click',closeFullPlayer);playerFavorite.addEventListener('click',()=>{if(currentSong!==-1)toggleFavorite(currentSong)});
let touchStartY=null,touchLastY=null;
playerScreen.addEventListener('touchstart',e=>{touchStartY=e.touches[0]?.clientY??null;touchLastY=touchStartY},{passive:true});
playerScreen.addEventListener('touchmove',e=>{touchLastY=e.touches[0]?.clientY??touchLastY},{passive:true});
playerScreen.addEventListener('touchend',()=>{if(touchStartY!==null&&touchLastY!==null&&touchLastY-touchStartY>105)closeFullPlayer();touchStartY=touchLastY=null});
coverStage.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=coverStage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;bigCover.style.setProperty('--tilt-x',`${(0.5-y)*8}deg`);bigCover.style.setProperty('--tilt-y',`${(x-0.5)*8}deg`)});
coverStage.addEventListener('pointerleave',resetCoverTilt);
function resetCoverTilt(){bigCover.style.setProperty('--tilt-x','0deg');bigCover.style.setProperty('--tilt-y','0deg')}

/* ---------- Dynamic color ---------- */
function updateDynamicColor(src){
    const img=new Image();
    img.onload=()=>{
        try{
            const c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true});c.width=c.height=32;ctx.drawImage(img,0,0,32,32);
            const d=ctx.getImageData(0,0,32,32).data;let r=0,g=0,b=0,w=0;
            for(let i=0;i<d.length;i+=16){
                const rr=d[i],gg=d[i+1],bb=d[i+2],br=(rr+gg+bb)/3;if(br<28||br>235)continue;
                const sat=Math.max(rr,gg,bb)-Math.min(rr,gg,bb),ww=1+sat/120;r+=rr*ww;g+=gg*ww;b+=bb*ww;w+=ww;
            }
            if(!w)return setDynamicRGB(130,78,255);
            r=Math.round(r/w);g=Math.round(g/w);b=Math.round(b/w);
            const m=Math.max(r,g,b);if(m<125){const f=125/Math.max(m,1);r=Math.min(255,Math.round(r*f));g=Math.min(255,Math.round(g*f));b=Math.min(255,Math.round(b*f))}
            setDynamicRGB(r,g,b);
        }catch{setDynamicRGB(130,78,255)}
    };
    img.onerror=()=>setDynamicRGB(130,78,255);img.src=src;
}
function setDynamicRGB(r,g,b){document.documentElement.style.setProperty('--dynamic-rgb',`${r},${g},${b}`)}

/* ---------- Media Session ---------- */
function updateMediaSession(){
    if(!('mediaSession'in navigator)||currentSong===-1)return;
    const s=songs[currentSong],art=s.artwork?[{src:s.artwork,sizes:'512x512',type:s.artwork.startsWith('data:image/png')?'image/png':'image/jpeg'}]:[];
    navigator.mediaSession.metadata=new MediaMetadata({title:s.title,artist:s.artist,album:s.album,artwork:art});
    safeMediaAction('play',()=>audio.play());safeMediaAction('pause',()=>audio.pause());safeMediaAction('previoustrack',previousSong);safeMediaAction('nexttrack',nextSong);
}
function safeMediaAction(a,h){try{navigator.mediaSession.setActionHandler(a,h)}catch{}}

/* ---------- Utils ---------- */
function formatTime(s){if(!Number.isFinite(s)||s<0)return'0:00';return`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`}
function removeExtension(f){return f.replace(/\.[^/.]+$/,'')}
function isAudioExtension(f){return /\.(mp3|m4a|aac|wav|flac|alac)$/i.test(f)}
function escapeHTML(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
window.addEventListener('beforeunload',()=>{if(activeObjectUrl)URL.revokeObjectURL(activeObjectUrl)});
