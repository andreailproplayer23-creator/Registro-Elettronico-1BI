// INSERISCI LE TUE CHIAVI FIREBASE QUI
const firebaseConfig = {
  apiKey: "AIzaSyC3B-HBxOB020rKQTOLZQ1GrLbTP7zf_gk",
  authDomain: "registro-elettronico-1bi.firebaseapp.com",
  projectId: "registro-elettronico-1bi",
  storageBucket: "registro-elettronico-1bi.firebasestorage.app",
  messagingSenderId: "467293141486",
  appId: "1:467293141486:web:f8ee3f8fe8c1a092ef76ff"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let dataCorrente = new Date();
let modalitaVista = 'mese';
let eventiLocali = [];

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (!user) window.location.href = "index.html";
        else {
            document.getElementById('nomeUtenteDisplay').textContent = `${sessionStorage.getItem("nomeUtente")} (Admin)`;
            impostaControlliCalendario();
            generaCalendario();
            ascoltaEventiAgenda();
            ascoltaComunicazioni();
            caricaCircolariSito(); // PROXY CORRETTO RIATTIVATO
        }
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => { 
    auth.signOut().then(() => { sessionStorage.clear(); window.location.href = "index.html"; }); 
});

function apriTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabName).style.display = 'block';
    event.currentTarget.classList.add('active');
}

function apriModal(id) { document.getElementById(id).style.display = 'flex'; }
function chiudiModal(id) { document.getElementById(id).style.display = 'none'; }
document.getElementById('btnNuovoEvento').addEventListener('click', () => apriModal('modalEvento'));
document.getElementById('btnNuovoAnnuncio').addEventListener('click', () => apriModal('modalAnnuncio'));

// Toggle checkbox Tutta la giornata per Eventi (Nuovo e Modifica)
document.getElementById('tuttaGiornata').addEventListener('change', function() { document.getElementById('timeGroup').classList.toggle('hidden', this.checked); });
document.getElementById('modTuttaGiornata').addEventListener('change', function() { document.getElementById('modTimeGroup').classList.toggle('hidden', this.checked); });

// ==========================================
// FIX: CARICAMENTO CIRCOLARI (CORS PROXY)
// ==========================================
async function caricaCircolariSito() {
    try {
        // Usiamo corsproxy.io che bypassa il blocco del sito della scuola
        const url = 'https://www.iisgiorgiwoolf.edu.it/gw/circolare/';
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Errore nel download della pagina");
        const htmlTesto = await response.text();
        
        // Estrazione molto basilare dei link (potresti dover adattare il selettore al codice sorgente esatto della scuola)
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlTesto, 'text/html');
        const links = doc.querySelectorAll('a[href*="circolare"]'); // Cerca i link alle circolari
        
        const lista = document.getElementById('listaCircolari');
        lista.innerHTML = '';
        
        if(links.length === 0) {
            lista.innerHTML = '<p class="info-text">Nessuna circolare trovata sulla pagina.</p>';
            return;
        }

        // Prende i primi 10
        Array.from(links).slice(0, 10).forEach(link => {
            const titolo = link.textContent.trim() || "Circolare";
            const href = link.href.startsWith('http') ? link.href : 'https://www.iisgiorgiwoolf.edu.it' + link.getAttribute('href');
            lista.innerHTML += `<div class="comunicazione-card">
                                    <a href="${href}" target="_blank" style="color: #60a5fa; font-weight: bold; text-decoration: none;">📄 ${titolo}</a>
                                </div>`;
        });
    } catch (error) {
        console.error("Errore circolari:", error);
        document.getElementById('listaCircolari').innerHTML = `<p class="info-text" style="color:#ef4444;">Accesso bloccato dal server della scuola.</p>`;
    }
}


// ==========================================
// CALENDARIO E AGENDA
// ==========================================
function impostaControlliCalendario() {
    document.getElementById('prevMonthBtn').addEventListener('click', () => { if(modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() - 1); else dataCorrente.setDate(dataCorrente.getDate() - 1); generaCalendario(); });
    document.getElementById('nextMonthBtn').addEventListener('click', () => { if(modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() + 1); else dataCorrente.setDate(dataCorrente.getDate() + 1); generaCalendario(); });
    document.getElementById('switchViewBtn').addEventListener('click', (e) => {
        modalitaVista = modalitaVista === 'mese' ? 'giorno' : 'mese';
        e.target.textContent = modalitaVista === 'mese' ? 'Vista Singola' : 'Vista Mese';
        generaCalendario();
    });
}

window.vaiAGiorno = function(giorno) {
    if(modalitaVista === 'mese') {
        dataCorrente.setDate(giorno);
        modalitaVista = 'giorno';
        document.getElementById('switchViewBtn').textContent = 'Vista Mese';
        generaCalendario();
    }
}

function generaCalendario() {
    const grid = document.getElementById('calendarGrid');
    grid.style.animation = 'none'; grid.offsetHeight; grid.style.animation = 'slideFadeIn 0.5s ease-out forwards';

    const anno = dataCorrente.getFullYear(); const mese = dataCorrente.getMonth(); const giorno = dataCorrente.getDate();
    const nomeMese = dataCorrente.toLocaleString('it-IT', { month: 'long' });
    document.getElementById('currentMonthDisplay').textContent = modalitaVista === 'mese' ? `${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}` : `${giorno} ${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}`;
    
    grid.innerHTML = '';
    if(modalitaVista === 'mese') {
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.innerHTML = `<div class="calendar-day header">LUN</div><div class="calendar-day header">MAR</div><div class="calendar-day header">MER</div><div class="calendar-day header">GIO</div><div class="calendar-day header">VEN</div><div class="calendar-day header">SAB</div><div class="calendar-day header">DOM</div>`;
        let offset = new Date(anno, mese, 1).getDay() === 0 ? 6 : new Date(anno, mese, 1).getDay() - 1; 
        for(let i=0; i<offset; i++) grid.innerHTML += `<div class="calendar-day" style="visibility:hidden;"></div>`;
        for(let i=1; i<=new Date(anno, mese + 1, 0).getDate(); i++) {
            let m = (mese+1).toString().padStart(2, '0'); let d = i.toString().padStart(2, '0');
            grid.innerHTML += `<div class="calendar-day" onclick="vaiAGiorno(${i})" style="cursor:pointer;"><span class="day-number">${i}</span><div class="events-container" id="events-${anno}-${m}-${d}"></div></div>`;
        }
    } else {
        grid.style.gridTemplateColumns = '1fr';
        let m = (mese+1).toString().padStart(2, '0'); let d = giorno.toString().padStart(2, '0');
        grid.innerHTML = `<div class="calendar-day" style="min-height: 400px; padding: 30px;"><h3 style="color:#fafafa; margin-bottom: 25px;">Eventi del ${giorno}/${m}/${anno}</h3><div class="events-container" id="events-${anno}-${m}-${d}" style="display:flex; flex-direction:column; gap:10px;"></div></div>`;
    }
    renderEventi();
}

function ascoltaEventiAgenda() {
    db.collection("agenda").onSnapshot((snapshot) => {
        eventiLocali = []; snapshot.forEach(doc => eventiLocali.push({ id: doc.id, ...doc.data() })); renderEventi();
    });
}

function renderEventi() {
    document.querySelectorAll('.events-container').forEach(c => c.innerHTML = ''); 
    eventiLocali.forEach((ev) => {
        const c = document.getElementById(`events-${ev.data}`);
        if(c) {
            const b = document.createElement('div'); b.className = 'evento-badge';
            if(modalitaVista === 'giorno') b.innerHTML = `<strong style="font-size:18px;">${ev.tipologia}</strong><br>🕒 ${ev.tuttaGiornata ? 'Tutto il giorno' : ev.oraInizio + ' - ' + ev.oraFine}`;
            else b.textContent = ev.tipologia;
            b.onclick = (e) => { e.stopPropagation(); apriDettaglioEventoAdmin(ev.id, ev); };
            c.appendChild(b);
        }
    });
}

// ==========================================
// CREAZIONE, MODIFICA E ELIMINAZIONE EVENTI
// ==========================================
function apriDettaglioEventoAdmin(id, evento) {
    document.getElementById('viewTipoEvento').textContent = evento.tipologia;
    document.getElementById('viewAutore').textContent = evento.autoreNome;
    document.getElementById('viewDataOrario').textContent = evento.tuttaGiornata ? `${evento.data} | Tutto il giorno` : `${evento.data} | ${evento.oraInizio} - ${evento.oraFine}`;
    document.getElementById('viewDescrizione').textContent = evento.descrizione || "Nessuna descrizione.";
    
    const list = document.getElementById('viewAllegatiList'); list.innerHTML = '';
    if(evento.allegati && evento.allegati.length > 0) {
        document.getElementById('viewAllegatiContainer').classList.remove('hidden');
        evento.allegati.forEach(f => list.innerHTML += `<a href="${f.url}" target="_blank" class="allegato-link">📎 ${f.name}</a>`);
    } else document.getElementById('viewAllegatiContainer').classList.add('hidden');

    // BOTTONE ELIMINA
    document.getElementById('btnEliminaEvento').onclick = () => {
        if(confirm(`Attenzione: Stai eliminando l'evento. Procedere?`)) { db.collection("agenda").doc(id).delete(); chiudiModal('modalVisualizzaEvento'); }
    };
    
    // BOTTONE MODIFICA
    document.getElementById('btnModificaEvento').onclick = () => {
        chiudiModal('modalVisualizzaEvento');
        document.getElementById('modEventoId').value = id;
        document.getElementById('modTipoEvento').value = evento.tipologia;
        document.getElementById('modDataEvento').value = evento.data;
        document.getElementById('modTuttaGiornata').checked = evento.tuttaGiornata;
        document.getElementById('modTimeGroup').classList.toggle('hidden', evento.tuttaGiornata);
        document.getElementById('modOraInizio').value = evento.oraInizio || '';
        document.getElementById('modOraFine').value = evento.oraFine || '';
        document.getElementById('modDescrizioneEvento').value = evento.descrizione || '';
        apriModal('modalModificaEvento');
    };
    
    apriModal('modalVisualizzaEvento');
}

document.getElementById('formModificaEvento').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "Salvataggio..."; btn.disabled = true;
    try {
        const id = document.getElementById('modEventoId').value;
        await db.collection("agenda").doc(id).update({
            tipologia: document.getElementById('modTipoEvento').value, data: document.getElementById('modDataEvento').value,
            tuttaGiornata: document.getElementById('modTuttaGiornata').checked,
            oraInizio: document.getElementById('modOraInizio').value || null, oraFine: document.getElementById('modOraFine').value || null,
            descrizione: document.getElementById('modDescrizioneEvento').value
        });
        chiudiModal('modalModificaEvento');
    } catch (err) { alert("Errore modifica: " + err.message); } finally { btn.textContent = "Salva Modifiche"; btn.disabled = false; }
});

document.getElementById('formEvento').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "Salvataggio..."; btn.disabled = true;
    try {
        let fileUrls = []; const files = document.getElementById('fileEvento').files;
        // FIX: Gestione corretta dei file iterati
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const s = await storage.ref(`agenda_allegati/${Date.now()}_${f.name}`).put(f);
                fileUrls.push({ name: f.name, url: await s.ref.getDownloadURL() });
            }
        }
        await db.collection("agenda").add({
            autoreUid: auth.currentUser.uid, autoreNome: sessionStorage.getItem("nomeUtente"),
            tipologia: document.getElementById('tipoEvento').value, data: document.getElementById('dataEvento').value, tuttaGiornata: document.getElementById('tuttaGiornata').checked,
            oraInizio: document.getElementById('oraInizio').value || null, oraFine: document.getElementById('oraFine').value || null,
            descrizione: document.getElementById('descrizioneEvento').value, allegati: fileUrls, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('formEvento').reset(); chiudiModal('modalEvento');
    } catch (err) { 
        console.error("ERRORE UPLOAD FIREBASE:", err);
        alert("Errore caricamento. Hai abilitato Storage in Firebase e impostato le Rules pubbliche in scrittura?"); 
    } finally { btn.textContent = "Salva Evento"; btn.disabled = false; }
});

// ==========================================
// BACHECA (COMUNICAZIONI): CREA, MODIFICA, ELIMINA
// ==========================================
function ascoltaComunicazioni() {
    db.collection("bacheca_rappresentanti").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        const lista = document.getElementById('listaComunicazioni'); lista.innerHTML = '';
        snapshot.forEach((doc) => {
            const c = doc.data();
            lista.innerHTML += `
                <div class="comunicazione-card">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h4>${c.titolo}</h4>
                        <div style="display:flex; gap:8px;">
                            <button onclick="apriModificaAnnuncio('${doc.id}', '${c.titolo.replace(/'/g, "\\'")}', '${(c.descrizione || '').replace(/'/g, "\\'")}')" class="glass-btn-small" style="padding: 4px 8px; font-size:12px;">✏️</button>
                            <button onclick="eliminaAnnuncioAdmin('${doc.id}')" class="glass-btn-small" style="padding: 4px 8px; font-size:12px; background:rgba(239,68,68,0.2); color:#ef4444;">🗑️</button>
                        </div>
                    </div>
                    <p class="autore-data">${c.autoreNome}</p>
                    <p class="desc">${c.descrizione || ''}</p>
                    ${c.allegatoUrl ? `<a href="${c.allegatoUrl}" target="_blank" class="allegato-link">📎 ${c.allegatoNome}</a>` : ''}
                </div>`;
        });
    });
}

window.eliminaAnnuncioAdmin = function(id) { if(confirm("Sei sicuro di voler eliminare questo annuncio?")) db.collection("bacheca_rappresentanti").doc(id).delete(); };

window.apriModificaAnnuncio = function(id, titolo, desc) {
    document.getElementById('modAnnuncioId').value = id;
    document.getElementById('modTitoloAnnuncio').value = titolo;
    document.getElementById('modDescrizioneAnnuncio').value = desc;
    apriModal('modalModificaAnnuncio');
};

document.getElementById('formModificaAnnuncio').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "Salvataggio..."; btn.disabled = true;
    try {
        await db.collection("bacheca_rappresentanti").doc(document.getElementById('modAnnuncioId').value).update({
            titolo: document.getElementById('modTitoloAnnuncio').value,
            descrizione: document.getElementById('modDescrizioneAnnuncio').value
        });
        chiudiModal('modalModificaAnnuncio');
    } catch (err) { alert("Errore modifica: " + err.message); } finally { btn.textContent = "Salva Modifiche"; btn.disabled = false; }
});

document.getElementById('formAnnuncio').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "Pubblicazione..."; btn.disabled = true;
    try {
        let url = null, nome = null; const files = document.getElementById('fileAnnuncio').files;
        // FIX: Gestione corretta file singolo in array
        if (files.length > 0) { 
            const f = files[0];
            const s = await storage.ref(`bacheca_allegati/${Date.now()}_${f.name}`).put(f); 
            url = await s.ref.getDownloadURL(); nome = f.name; 
        }
        await db.collection("bacheca_rappresentanti").add({
            autoreUid: auth.currentUser.uid, autoreNome: sessionStorage.getItem("nomeUtente"),
            titolo: document.getElementById('titoloAnnuncio').value, descrizione: document.getElementById('descrizioneAnnuncio').value,
            allegatoUrl: url, allegatoNome: nome, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('formAnnuncio').reset(); chiudiModal('modalAnnuncio');
    } catch (err) { 
        console.error("ERRORE UPLOAD FIREBASE:", err);
        alert("Errore caricamento file. Controlla le regole del tuo Firebase Storage."); 
    } finally { btn.textContent = "Pubblica"; btn.disabled = false; }
});