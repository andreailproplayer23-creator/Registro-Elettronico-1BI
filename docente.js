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

// SUPABASE CONFIG
const supabaseUrl = 'https://tzmgogjgclzhgptaostj.supabase.co'; 
const supabaseKey = 'sb_publishable_oPP6dEhLULujKfWzUFi-3g_nXPCYS6q'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'storage-1bi';

let dataCorrente = new Date();
let modalitaVista = 'mese';
let eventiLocali = [];
let comunicazioniLocali = {};

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (!user) window.location.href = "index.html";
        else {
            // Controllo se mancano i dati in sessione (incluso il ruolo)
            if (!sessionStorage.getItem("nomeUtente") || !sessionStorage.getItem("ruoloUtente")) {
                db.collection("utenti").doc(user.uid).get().then(doc => {
                    if (doc.exists) {
                        const d = doc.data();
                        sessionStorage.setItem("nomeUtente", d.nome);
                        sessionStorage.setItem("cognomeUtente", d.cognome);
                        sessionStorage.setItem("ruoloUtente", d.ruolo || "docente"); // Salva il ruolo, default a docente
                        
                        // Imposta la scritta in base al ruolo
                        const ruoloDisplay = d.ruolo === "admin" ? "Admin" : "Docente";
                        document.getElementById('nomeUtenteDisplay').textContent = `${d.nome} ${d.cognome} (${ruoloDisplay})`;
                    }
                });
            } else {
                // Se i dati sono già salvati nella sessione del browser
                const nome = sessionStorage.getItem("nomeUtente");
                const cognome = sessionStorage.getItem("cognomeUtente");
                const ruolo = sessionStorage.getItem("ruoloUtente") === "admin" ? "Admin" : "Docente";
                document.getElementById('nomeUtenteDisplay').textContent = `${nome} ${cognome} (${ruolo})`;
            }
            impostaControlliCalendario();
            generaCalendario();
            ascoltaEventiAgenda();
            ascoltaComunicazioni();
            caricaCircolariSito();
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
document.getElementById('tuttaGiornata').addEventListener('change', function() {
    document.getElementById('timeGroup').classList.toggle('hidden', this.checked);
});
document.getElementById('modTuttaGiornata').addEventListener('change', function() {
    document.getElementById('modTimeGroup').classList.toggle('hidden', this.checked);
});

// ==========================================
// CALENDARIO (MESE E VISTA SINGOLA)
// ==========================================
function impostaControlliCalendario() {
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        if (modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() - 1);
        else dataCorrente.setDate(dataCorrente.getDate() - 1);
        generaCalendario();
    });
    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        if (modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() + 1);
        else dataCorrente.setDate(dataCorrente.getDate() + 1);
        generaCalendario();
    });
    document.getElementById('switchViewBtn').addEventListener('click', (e) => {
        modalitaVista = modalitaVista === 'mese' ? 'giorno' : 'mese';
        e.target.textContent = modalitaVista === 'mese' ? 'Vista Singola' : 'Vista Mese';
        generaCalendario();
    });
}

window.vaiAGiorno = function(giorno) {
    if (modalitaVista === 'mese') {
        dataCorrente.setDate(giorno);
        modalitaVista = 'giorno';
        document.getElementById('switchViewBtn').textContent = 'Vista Mese';
        generaCalendario();
    }
};

function generaCalendario() {
    const grid = document.getElementById('calendarGrid');
    grid.style.animation = 'none'; grid.offsetHeight; grid.style.animation = 'slideFadeIn 0.4s ease-out forwards';

    const anno = dataCorrente.getFullYear();
    const mese = dataCorrente.getMonth();
    const giorno = dataCorrente.getDate();
    const nomeMese = dataCorrente.toLocaleString('it-IT', { month: 'long' });
    
    document.getElementById('currentMonthDisplay').textContent = modalitaVista === 'mese' 
        ? `${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}` 
        : `${giorno} ${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}`;

    grid.innerHTML = '';
    if (modalitaVista === 'mese') {
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.innerHTML = `
            <div class="calendar-day header">LUN</div><div class="calendar-day header">MAR</div>
            <div class="calendar-day header">MER</div><div class="calendar-day header">GIO</div>
            <div class="calendar-day header">VEN</div><div class="calendar-day header">SAB</div>
            <div class="calendar-day header">DOM</div>
        `;
        let primoGiorno = new Date(anno, mese, 1).getDay();
        let offset = primoGiorno === 0 ? 6 : primoGiorno - 1; 
        const giorniNelMese = new Date(anno, mese + 1, 0).getDate();

        for(let i=0; i<offset; i++) grid.innerHTML += `<div class="calendar-day" style="visibility:hidden"></div>`;
        
        for(let i=1; i<=giorniNelMese; i++) {
            let m = (mese+1).toString().padStart(2, '0');
            let d = i.toString().padStart(2, '0');
            grid.innerHTML += `
                <div class="calendar-day" onclick="vaiAGiorno(${i})" style="cursor:pointer;">
                    <span class="day-number">${i}</span>
                    <div class="events-container" id="events-${anno}-${m}-${d}"></div>
                </div>
            `;
        }
    } else {
        grid.style.gridTemplateColumns = '1fr';
        let m = (mese+1).toString().padStart(2, '0');
        let d = giorno.toString().padStart(2, '0');
        grid.innerHTML = `
            <div class="calendar-day" style="min-height: 400px; padding: 30px;">
                <h3 style="color:#fafafa; margin-bottom: 25px;">Eventi del ${giorno}/${m}/${anno}</h3>
                <div class="events-container" id="events-${anno}-${m}-${d}" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>
        `;
    }
    renderEventi();
}

function ascoltaEventiAgenda() {
    db.collection("agenda").onSnapshot((snapshot) => {
        eventiLocali = [];
        snapshot.forEach((doc) => eventiLocali.push({ id: doc.id, ...doc.data() }));
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
            if (modalitaVista === 'giorno') {
                badge.innerHTML = `<strong style="font-size:18px;">${ev.tipologia}</strong> <span style="opacity:0.7; font-size:13px;">(${ev.autoreNome})</span><br>🕒 ${ev.tuttaGiornata ? 'Tutto il giorno' : ev.oraInizio + ' - ' + ev.oraFine}`;
            } else {
                badge.textContent = ev.tipologia;
            }
            badge.onclick = (e) => { e.stopPropagation(); apriDettaglioEvento(ev.id, ev); };
            contenitore.appendChild(badge);
        }
    });
}

// ==========================================
// GESTIONE EVENTI (DOCENTE MODIFICA/ELIMINA SOLO I SUOI)
// ==========================================
function apriDettaglioEvento(id, evento) {
    document.getElementById('viewTipoEvento').textContent = evento.tipologia;
    document.getElementById('viewAutore').textContent = evento.autoreNome;
    document.getElementById('viewDataOrario').textContent = evento.tuttaGiornata ? `${evento.data} | Tutta la giornata` : `${evento.data} | ${evento.oraInizio} - ${evento.oraFine}`;
    document.getElementById('viewDescrizione').textContent = evento.descrizione || "Nessuna descrizione fornita.";
    
    const containerAll = document.getElementById('viewAllegatiContainer');
    const listAll = document.getElementById('viewAllegatiList');
    listAll.innerHTML = '';
    
    if(evento.allegati && evento.allegati.length > 0) {
        containerAll.classList.remove('hidden');
        evento.allegati.forEach(f => listAll.innerHTML += `<a href="${f.url}" target="_blank" class="allegato-link">📎 ${f.name}</a>`);
    } else { containerAll.classList.add('hidden'); }

    const btnElimina = document.getElementById('btnEliminaEvento');
    const btnModifica = document.getElementById('btnModificaEvento');

    if(evento.autoreUid === auth.currentUser.uid) {
        btnElimina.classList.remove('hidden');
        btnModifica.classList.remove('hidden');

        btnElimina.onclick = () => {
            if(confirm("Vuoi davvero eliminare questo evento?")) {
                db.collection("agenda").doc(id).delete();
                chiudiModal('modalVisualizzaEvento');
            }
        };

        btnModifica.onclick = () => {
            chiudiModal('modalVisualizzaEvento');
            document.getElementById('modEventoId').value = id;
            document.getElementById('modTipoEvento').value = evento.tipologia;
            document.getElementById('modDataEvento').value = evento.data;
            document.getElementById('modTuttaGiornata').checked = evento.tuttaGiornata;
            document.getElementById('modTimeGroup').classList.toggle('hidden', evento.tuttaGiornata);
            document.getElementById('modOraInizio').value = evento.oraInizio || "";
            document.getElementById('modOraFine').value = evento.oraFine || "";
            document.getElementById('modDescrizioneEvento').value = evento.descrizione || "";
            apriModal('modalModificaEvento');
        };
    } else {
        btnElimina.classList.add('hidden');
        btnModifica.classList.add('hidden');
    }
    apriModal('modalVisualizzaEvento');
}

document.getElementById('formModificaEvento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modEventoId').value;
    try {
        await db.collection("agenda").doc(id).update({
            tipologia: document.getElementById('modTipoEvento').value,
            data: document.getElementById('modDataEvento').value,
            tuttaGiornata: document.getElementById('modTuttaGiornata').checked,
            oraInizio: document.getElementById('modOraInizio').value || null,
            oraFine: document.getElementById('modOraFine').value || null,
            descrizione: document.getElementById('modDescrizioneEvento').value,
        });
        chiudiModal('modalModificaEvento');
    } catch (err) { alert("Errore modifica: " + err.message); }
});

document.getElementById('formEvento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Caricamento..."; btn.disabled = true;
    try {
        let fileUrls = [];
        const files = document.getElementById('fileEvento').files;
        
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const safeName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `agenda/${Date.now()}_${safeName}`;
                
                const { error } = await supabaseClient.storage.from(BUCKET_NAME).upload(filePath, f);
                if (error) throw error;
                
                const { data: publicUrlData } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(filePath);
                fileUrls.push({ name: f.name, url: publicUrlData.publicUrl });
            }
        }

        await db.collection("agenda").add({
            autoreUid: auth.currentUser.uid,
            autoreNome: sessionStorage.getItem("nomeUtente") + " " + sessionStorage.getItem("cognomeUtente"),
            tipologia: document.getElementById('tipoEvento').value,
            data: document.getElementById('dataEvento').value,
            tuttaGiornata: document.getElementById('tuttaGiornata').checked,
            oraInizio: document.getElementById('oraInizio').value || null,
            oraFine: document.getElementById('oraFine').value || null,
            descrizione: document.getElementById('descrizioneEvento').value,
            allegati: fileUrls,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('formEvento').reset();
        chiudiModal('modalEvento');
    } catch (err) { alert("Errore caricamento: " + err.message); } 
    finally { btn.textContent = "Salva Evento"; btn.disabled = false; }
});

// ==========================================
// BACHECA (DOCENTE MODIFICA/ELIMINA SOLO I SUOI)
// ==========================================
function ascoltaComunicazioni() {
    db.collection("bacheca_rappresentanti").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        const lista = document.getElementById('listaComunicazioni');
        lista.innerHTML = '';
        comunicazioniLocali = {};

        snapshot.forEach((doc) => {
            const c = doc.data();
            comunicazioniLocali[doc.id] = c;
            const isMine = c.autoreUid === auth.currentUser.uid;

            lista.innerHTML += `
                <div class="comunicazione-card">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h4>${c.titolo}</h4>
                        ${isMine ? `
                        <div style="display:flex; gap:8px;">
                            <button onclick="apriModificaAnnuncioDocente('${doc.id}')" class="glass-btn-small" style="padding: 4px 8px; font-size:12px;">✏️</button>
                            <button onclick="eliminaAnnuncioDocente('${doc.id}')" class="glass-btn-small" style="padding: 4px 8px; font-size:12px; background:rgba(239,68,68,0.2); color:#ef4444;">🗑️</button>
                        </div>` : ''}
                    </div>
                    <p class="autore-data">${c.autoreNome}</p>
                    <p class="desc">${c.descrizione || ''}</p>
                    ${c.allegatoUrl ? `<a href="${c.allegatoUrl}" target="_blank" class="allegato-link">📎 ${c.allegatoNome}</a>` : ''}
                </div>`;
        });
    });
}

window.eliminaAnnuncioDocente = (id) => {
    if(confirm("Sei sicuro di voler eliminare questa tua comunicazione?")) {
        db.collection("bacheca_rappresentanti").doc(id).delete();
    }
};

window.apriModificaAnnuncioDocente = (id) => {
    const c = comunicazioniLocali[id];
    if(!c) return;
    document.getElementById('modAnnuncioId').value = id;
    document.getElementById('modTitoloAnnuncio').value = c.titolo;
    document.getElementById('modDescrizioneAnnuncio').value = c.descrizione || '';
    apriModal('modalModificaAnnuncio');
};

document.getElementById('formModificaAnnuncio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modAnnuncioId').value;
    try {
        await db.collection("bacheca_rappresentanti").doc(id).update({
            titolo: document.getElementById('modTitoloAnnuncio').value,
            descrizione: document.getElementById('modDescrizioneAnnuncio').value
        });
        chiudiModal('modalModificaAnnuncio');
    } catch (err) { alert("Errore modifica: " + err.message); }
});

document.getElementById('formAnnuncio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Pubblicazione..."; btn.disabled = true;
    try {
        let url = null, nome = null;
        const file = document.getElementById('fileAnnuncio').files[0];
        
        if (file) {
            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `bacheca/${Date.now()}_${safeName}`;
            
            const { error } = await supabaseClient.storage.from(BUCKET_NAME).upload(filePath, file);
            if (error) throw error;
            
            const { data: publicUrlData } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(filePath);
            url = publicUrlData.publicUrl; 
            nome = file.name;
        }

        await db.collection("bacheca_rappresentanti").add({
            autoreUid: auth.currentUser.uid,
            autoreNome: sessionStorage.getItem("nomeUtente") + " " + sessionStorage.getItem("cognomeUtente"),
            titolo: document.getElementById('titoloAnnuncio').value,
            descrizione: document.getElementById('descrizioneAnnuncio').value,
            allegatoUrl: url, allegatoNome: nome,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('formAnnuncio').reset();
        chiudiModal('modalAnnuncio');
    } catch (err) { alert("Errore caricamento: " + err.message); } 
    finally { btn.textContent = "Pubblica"; btn.disabled = false; }
});

// ==========================================
// CIRCOLARI SCUOLA
// ==========================================
// 1. Inserisci questa funzione fuori/sopra caricaCircolariSito
window.forzaDownloadPdf = function(url, titoloOrig) {
    // Usiamo un proxy gratuito per aggirare il blocco di sicurezza del browser e "catturare" il PDF
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
    const nomeFile = titoloOrig.replace(/[^a-zA-Z0-9 ]/g, "") + ".pdf";
    
    fetch(proxyUrl)
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.blob();
        })
        .then(blob => {
            // Crea un file locale invisibile e forza il click per scaricarlo
            const urlBlob = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlBlob;
            link.download = nomeFile;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(urlBlob); // Pulisce la memoria
        })
        .catch(err => {
            console.error("Download forzato fallito, fallback:", err);
            // Fallback: se il proxy fallisce, apre comunque il file in una NUOVA scheda (non nella stessa)
            window.open(url, '_blank');
        });
};


// 2. Aggiorna SOLO la parte del pulsante "Scarica" dentro caricaCircolariSito()
// 1. Inserisci questa funzione fuori/sopra caricaCircolariSito
window.forzaDownloadPdf = function(url, titoloOrig) {
    // Usiamo un proxy gratuito per aggirare il blocco di sicurezza del browser e "catturare" il PDF
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
    const nomeFile = titoloOrig.replace(/[^a-zA-Z0-9 ]/g, "") + ".pdf";
    
    fetch(proxyUrl)
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.blob();
        })
        .then(blob => {
            // Crea un file locale invisibile e forza il click per scaricarlo
            const urlBlob = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlBlob;
            link.download = nomeFile;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(urlBlob); // Pulisce la memoria
        })
        .catch(err => {
            console.error("Download forzato fallito, fallback:", err);
            // Fallback: se il proxy fallisce, apre comunque il file in una NUOVA scheda (non nella stessa)
            window.open(url, '_blank');
        });
};


// 2. Aggiorna SOLO la parte del pulsante "Scarica" dentro caricaCircolariSito()
// 1. Funzione per forzare il download (messa fuori così funziona per tutti i pulsanti)
window.forzaDownloadPdf = async function(url, titoloOrig, event) {
    if(event) event.preventDefault();
    
    const targetBtn = event.currentTarget;
    const testoOriginale = targetBtn.innerHTML;
    
    targetBtn.innerHTML = "⏳ Download...";
    
    const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
    const nomeFile = titoloOrig.replace(/[^a-zA-Z0-9 ]/g, "") + ".pdf";

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Errore di rete");
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = nomeFile;
        document.body.appendChild(a);
        
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        }, 1000);
        
    } catch (error) {
        console.error("Download bloccato:", error);
        window.open(url, '_blank'); // Fallback in caso di blocco totale
    } finally {
        targetBtn.innerHTML = testoOriginale;
    }
};

// 2. La funzione che carica e mostra le circolari a schermo
function caricaCircolariSito() {
    const lista = document.getElementById('listaCircolari');
    if (!lista) return;

    db.collection("circolari_scuola").orderBy("ordine", "asc").onSnapshot((snapshot) => {
        lista.innerHTML = '';

        if (snapshot.empty) {
            lista.innerHTML = `
                <div style="text-align: center; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                    <p style="color: #aaa; margin-bottom: 15px; font-size: 13px;">Nessuna circolare sincronizzata al momento.</p>
                </div>
            `;
            return;
        }

        snapshot.forEach((doc) => {
            const c = doc.data();
            
            const descrizioneDisplay = c.descrizione ? `<p style="font-size: 11px; color: #aaa; margin: 5px 0 8px 0; line-height: 1.4;">${c.descrizione}</p>` : '';
            const titoloPulito = c.titolo.replace(/'/g, "\\'");

            lista.innerHTML += `
                <div class="comunicazione-card" style="margin-bottom: 15px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 10px; border-left: 4px solid #4da6ff;">
                    <h4 style="margin: 0 0 5px 0; font-size: 14px; line-height: 1.4;">${c.titolo}</h4>
                    ${descrizioneDisplay}
                    <p class="autore-data" style="margin: 0 0 10px 0; font-size: 10px; opacity: 0.6;">IIS Giorgi-Woolf - A.S. 2026/2027</p>
                    
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="glass-btn-small" style="text-decoration: none; background: rgba(77, 166, 255, 0.15); color: #4da6ff; padding: 6px 12px; font-size: 11px; border-radius: 5px;">
                            👁️ Visualizza
                        </a>
                        
                        <button onclick="forzaDownloadPdf('${c.url}', '${titoloPulito}', event)" class="glass-btn-small" style="cursor: pointer; border: none; background: rgba(77, 255, 166, 0.15); color: #4dffa6; padding: 6px 12px; font-size: 11px; border-radius: 5px;">
                            ⬇️ Scarica PDF
                        </button>
                    </div>
                </div>
            `;
        });
    }, (error) => {
        console.error("Errore lettura circolari:", error);
        lista.innerHTML = '<p class="error-message">Errore nel caricamento delle circolari.</p>';
    });
}
// --- FINE CODICE CIRCOLARI ---