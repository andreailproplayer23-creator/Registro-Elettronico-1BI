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

// --- VARIABILI GLOBALI CALENDARIO ---
let dataCorrente = new Date();
let modalitaVista = 'mese'; // può essere 'mese' o 'giorno'
let eventiLocali = []; // Salviamo gli eventi in RAM

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (!user) window.location.href = "index.html";
        else {
            document.getElementById('nomeUtenteDisplay').textContent = `${sessionStorage.getItem("nomeUtente")} ${sessionStorage.getItem("cognomeUtente")} (Admin)`;
            impostaControlliCalendario();
            generaCalendario();
            ascoltaEventiAgenda();
            ascoltaComunicazioni();
            // caricaCircolariSito(); // ATTUALMENTE DISABILITATO PER ERRORE PROXY
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
document.getElementById('tuttaGiornata').addEventListener('change', function() { document.getElementById('timeGroup').classList.toggle('hidden', this.checked); });

// ==========================================
// LOGICA CALENDARIO (MESE E GIORNO)
// ==========================================

function impostaControlliCalendario() {
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        if(modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() - 1);
        else dataCorrente.setDate(dataCorrente.getDate() - 1);
        generaCalendario();
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        if(modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() + 1);
        else dataCorrente.setDate(dataCorrente.getDate() + 1);
        generaCalendario();
    });

    document.getElementById('switchViewBtn').addEventListener('click', (e) => {
        modalitaVista = modalitaVista === 'mese' ? 'giorno' : 'mese';
        e.target.textContent = modalitaVista === 'mese' ? 'Vista Singola' : 'Vista Mese';
        generaCalendario();
    });
}

// Funzione richiamabile cliccando su un giorno specifico nella griglia mensile
window.vaiAGiorno = function(giornoSelezionato) {
    if(modalitaVista === 'mese') {
        dataCorrente.setDate(giornoSelezionato);
        modalitaVista = 'giorno';
        document.getElementById('switchViewBtn').textContent = 'Vista Mese';
        generaCalendario();
    }
}

function generaCalendario() {
    const grid = document.getElementById('calendarGrid');
    
    // --- RESET ANIMAZIONE A OGNI CAMBIO ---
    grid.style.animation = 'none'; 
    grid.offsetHeight; // Forza il browser a ricaricare l'elemento (Reflow)
    grid.style.animation = 'slideFadeIn 0.5s ease-out forwards';
    // --------------------------------------

    const display = document.getElementById('currentMonthDisplay');
    const anno = dataCorrente.getFullYear(); 
    const mese = dataCorrente.getMonth();
    const giorno = dataCorrente.getDate();
    
    const nomeMese = dataCorrente.toLocaleString('it-IT', { month: 'long' });
    
    display.textContent = modalitaVista === 'mese' 
        ? `${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}` 
        : `${giorno} ${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}`;

    grid.innerHTML = '';

    if(modalitaVista === 'mese') {
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.innerHTML = `<div class="calendar-day header">LUN</div><div class="calendar-day header">MAR</div><div class="calendar-day header">MER</div><div class="calendar-day header">GIO</div><div class="calendar-day header">VEN</div><div class="calendar-day header">SAB</div><div class="calendar-day header">DOM</div>`;
        
        let offset = new Date(anno, mese, 1).getDay() === 0 ? 6 : new Date(anno, mese, 1).getDay() - 1; 
        for(let i=0; i<offset; i++) grid.innerHTML += `<div class="calendar-day" style="visibility:hidden; border:none; background:transparent; animation:none;"></div>`;
        
        for(let i=1; i<=new Date(anno, mese + 1, 0).getDate(); i++) {
            let m = (mese+1).toString().padStart(2, '0'); let d = i.toString().padStart(2, '0');
            let dataStr = `${anno}-${m}-${d}`;
            // Calcolo ritardo animazione a cascata per i giorni
            let animDelay = (i * 0.01) + 's';
            grid.innerHTML += `
                <div class="calendar-day" onclick="vaiAGiorno(${i})" style="cursor:pointer; animation-delay: ${animDelay};" title="Clicca per espandere il giorno">
                    <span class="day-number">${i}</span>
                    <div class="events-container" id="events-${dataStr}"></div>
                </div>`;
        }
    } else {
        grid.style.gridTemplateColumns = '1fr';
        let m = (mese+1).toString().padStart(2, '0'); let d = giorno.toString().padStart(2, '0');
        let dataStr = `${anno}-${m}-${d}`;
        grid.innerHTML = `
            <div class="calendar-day" style="min-height: 500px; cursor: default; padding: 30px;">
                <h3 style="color:#fafafa; font-size: 22px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">Eventi in programma per il ${giorno}/${m}/${anno}</h3>
                <div class="events-container" id="events-${dataStr}" style="display: flex; flex-direction: column; gap: 15px;"></div>
            </div>`;
    }
    
    renderEventi();
}

// ==========================================
// FIREBASE LISTENERS E SALVATAGGI
// ==========================================

function ascoltaEventiAgenda() {
    db.collection("agenda").onSnapshot((snapshot) => {
        eventiLocali = [];
        snapshot.forEach((doc) => {
            eventiLocali.push({ id: doc.id, ...doc.data() });
        });
        renderEventi();
    });
}

function renderEventi() {
    document.querySelectorAll('.events-container').forEach(c => c.innerHTML = ''); 
    eventiLocali.forEach((ev) => {
        const contenitore = document.getElementById(`events-${ev.data}`);
        if(contenitore) {
            const badge = document.createElement('div');
            badge.className = 'evento-badge';
            
            if(modalitaVista === 'giorno') {
                badge.style.padding = "16px";
                badge.style.fontSize = "15px";
                const orario = ev.tuttaGiornata ? 'Tutta la giornata' : `${ev.oraInizio} - ${ev.oraFine}`;
                badge.innerHTML = `<strong style="font-size:18px; color:#fff;">${ev.tipologia}</strong><br><span style="color:#a1a1aa; font-size:13px;">🕒 ${orario}</span>`;
            } else {
                badge.textContent = ev.tipologia;
            }
            
            badge.onclick = (e) => { e.stopPropagation(); apriDettaglioEventoAdmin(ev.id, ev); };
            contenitore.appendChild(badge);
        }
    });
}

function apriDettaglioEventoAdmin(id, evento) {
    document.getElementById('viewTipoEvento').textContent = evento.tipologia;
    document.getElementById('viewAutore').textContent = evento.autoreNome;
    document.getElementById('viewDataOrario').textContent = evento.tuttaGiornata ? `${evento.data} | Tutto il giorno` : `${evento.data} | ${evento.oraInizio} - ${evento.oraFine}`;
    document.getElementById('viewDescrizione').textContent = evento.descrizione || "Nessuna descrizione.";
    
    const listAll = document.getElementById('viewAllegatiList');
    listAll.innerHTML = '';
    if(evento.allegati && evento.allegati.length > 0) {
        document.getElementById('viewAllegatiContainer').classList.remove('hidden');
        evento.allegati.forEach(f => listAll.innerHTML += `<a href="${f.url}" target="_blank" class="allegato-link">📎 ${f.name}</a>`);
    } else document.getElementById('viewAllegatiContainer').classList.add('hidden');

    document.getElementById('btnEliminaEvento').onclick = () => {
        if(confirm(`Attenzione: Stai eliminando l'evento di ${evento.autoreNome}. Procedere?`)) {
            db.collection("agenda").doc(id).delete();
            chiudiModal('modalVisualizzaEvento');
        }
    };
    apriModal('modalVisualizzaEvento');
}

function ascoltaComunicazioni() {
    db.collection("bacheca_rappresentanti").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        const lista = document.getElementById('listaComunicazioni');
        lista.innerHTML = '';
        snapshot.forEach((doc) => {
            const c = doc.data();
            lista.innerHTML += `
                <div class="comunicazione-card">
                    <div style="display:flex; justify-content:space-between;">
                        <h4>${c.titolo}</h4>
                        <button onclick="eliminaAnnuncioAdmin('${doc.id}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Forza Eliminazione">🗑️</button>
                    </div>
                    <p class="autore-data">${c.autoreNome}</p>
                    <p class="desc">${c.descrizione || ''}</p>
                    ${c.allegatoUrl ? `<a href="${c.allegatoUrl}" target="_blank" class="allegato-link">📎 ${c.allegatoNome}</a>` : ''}
                </div>`;
        });
    });
}

function eliminaAnnuncioAdmin(id) {
    if(confirm("Forzare l'eliminazione di questo annuncio dalla bacheca?")) db.collection("bacheca_rappresentanti").doc(id).delete();
}

document.getElementById('formEvento').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "Salvataggio..."; btn.disabled = true;
    try {
        let fileUrls = []; const files = document.getElementById('fileEvento').files;
        for (let f of files) { const s = await storage.ref(`agenda_allegati/${Date.now()}_${f.name}`).put(f); fileUrls.push({ name: f.name, url: await s.ref.getDownloadURL() }); }
        await db.collection("agenda").add({
            autoreUid: auth.currentUser.uid, autoreNome: sessionStorage.getItem("nomeUtente") + " (Admin)",
            tipologia: document.getElementById('tipoEvento').value, data: document.getElementById('dataEvento').value, tuttaGiornata: document.getElementById('tuttaGiornata').checked,
            oraInizio: document.getElementById('oraInizio').value || null, oraFine: document.getElementById('oraFine').value || null,
            descrizione: document.getElementById('descrizioneEvento').value, allegati: fileUrls, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('formEvento').reset(); chiudiModal('modalEvento');
    } catch (err) { alert(err.message); } finally { btn.textContent = "Salva come Admin"; btn.disabled = false; }
});

document.getElementById('formAnnuncio').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = "Pubblicazione..."; btn.disabled = true;
    try {
        let url = null, nome = null; const f = document.getElementById('fileAnnuncio').files[0];
        if (f) { const s = await storage.ref(`bacheca_allegati/${Date.now()}_${f.name}`).put(f); url = await s.ref.getDownloadURL(); nome = f.name; }
        await db.collection("bacheca_rappresentanti").add({
            autoreUid: auth.currentUser.uid, autoreNome: sessionStorage.getItem("nomeUtente") + " (Admin)",
            titolo: document.getElementById('titoloAnnuncio').value, descrizione: document.getElementById('descrizioneAnnuncio').value,
            allegatoUrl: url, allegatoNome: nome, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('formAnnuncio').reset(); chiudiModal('modalAnnuncio');
    } catch (err) { alert(err.message); } finally { btn.textContent = "Pubblica come Admin"; btn.disabled = false; }
});