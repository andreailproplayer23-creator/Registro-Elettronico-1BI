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

// Variabili di stato per il calendario
let dataCorrente = new Date();
let modalitaVista = 'mese';
let eventiLocali = [];

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        // Recupero e controllo sicurezza ruolo
        const doc = await db.collection("utenti").doc(user.uid).get();
        if (doc.exists) {
            const d = doc.data();
            const ruolo = (d.ruolo || "").toLowerCase().trim();

            // Reindirizza se non è studente (sicurezza aggiuntiva)
            if (ruolo !== "studente") {
                window.location.href = ruolo === "admin" ? "admin.html" : "docente.html";
                return;
            }

            sessionStorage.setItem("nomeUtente", d.nome);
            sessionStorage.setItem("cognomeUtente", d.cognome || "");
            document.getElementById('nomeUtenteDisplay').textContent = `${d.nome} ${d.cognome || ''} (Studente)`.trim();
        } else {
            window.location.href = "index.html";
            return;
        }

        impostaControlliCalendario();
        generaCalendario();
        ascoltaEventiAgenda();
        ascoltaComunicazioni();
        caricaCircolariSito();
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

// ==========================================
// GESTIONE CALENDARIO INTERATTIVO
// ==========================================
function impostaControlliCalendario() {
    // Se nel tuo studente.html esistono i pulsanti Mese/Giorno o le frecce, li colleghiamo qui
    const btnMese = document.getElementById('btnMese'); // Assicurati di avere ID corrispondenti se li usi
    const btnGiorno = document.getElementById('btnGiorno');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    if (btnMese) btnMese.addEventListener('click', () => { modalitaVista = 'mese'; generaCalendario(); });
    if (btnGiorno) btnGiorno.addEventListener('click', () => { modalitaVista = 'giorno'; generaCalendario(); });
    
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => {
        if (modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() - 1);
        else dataCorrente.setDate(dataCorrente.getDate() - 1);
        generaCalendario();
    });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => {
        if (modalitaVista === 'mese') dataCorrente.setMonth(dataCorrente.getMonth() + 1);
        else dataCorrente.setDate(dataCorrente.getDate() + 1);
        generaCalendario();
    });
}

window.vaiAGiorno = function(giorno) {
    if (modalitaVista === 'mese') {
        dataCorrente.setDate(giorno);
        modalitaVista = 'giorno';
        generaCalendario();
    }
};

function generaCalendario() {
    const grid = document.querySelector('.calendar-grid');
    if (!grid) return;

    grid.style.animation = 'none'; 
    grid.offsetHeight; 
    grid.style.animation = 'slideFadeIn 0.4s ease-out forwards';

    const anno = dataCorrente.getFullYear();
    const mese = dataCorrente.getMonth();
    const giorno = dataCorrente.getDate();
    const nomeMese = dataCorrente.toLocaleString('it-IT', { month: 'long' });
    
    // Aggiorna un eventuale display del mese corrente (se presente in HTML)
    const displayMese = document.getElementById('currentMonthDisplay');
    if (displayMese) {
        displayMese.textContent = modalitaVista === 'mese' 
            ? `${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}` 
            : `${giorno} ${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)} ${anno}`;
    }

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
        // VISTA GIORNO SINGOLO
        grid.style.gridTemplateColumns = '1fr';
        let m = (mese+1).toString().padStart(2, '0');
        let d = giorno.toString().padStart(2, '0');
        grid.innerHTML = `
            <div class="calendar-day" style="min-height: 400px; padding: 30px;">
                <h3 style="color:#fafafa; margin-bottom: 25px;">Eventi del ${giorno}/${m}/${anno}</h3>
                <div class="events-container" id="events-${anno}-${m}-${d}" style="display:flex; flex-direction:column; gap:10px;"></div>
                <button onclick="modalitaVista='mese'; generaCalendario()" class="glass-btn-small" style="margin-top: 20px; background: rgba(255,255,255,0.1); width: fit-content;">⬅ Torna al Mese</button>
            </div>
        `;
    }
    renderEventiStudente();
}

function ascoltaEventiAgenda() {
    db.collection("agenda").onSnapshot((snapshot) => {
        eventiLocali = [];
        snapshot.forEach((doc) => eventiLocali.push({ id: doc.id, ...doc.data() }));
        renderEventiStudente();
    });
}

function renderEventiStudente() {
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
            
            // Previene l'apertura della vista giorno se si clicca sull'evento
            badge.onclick = (e) => { 
                e.stopPropagation(); 
                apriDettaglioEvento(ev); 
            };
            contenitore.appendChild(badge);
        }
    });
}

function apriDettaglioEvento(evento) {
    document.getElementById('viewTipoEvento').textContent = evento.tipologia;
    try {
        document.getElementById('viewAutore').textContent = evento.autoreNome || "Scuola";
        document.getElementById('viewData').textContent = evento.data;
        document.getElementById('viewOrario').textContent = evento.tuttaGiornata ? `Tutta la giornata` : `${evento.oraInizio} - ${evento.oraFine}`;
    } catch(e) {}
    
    document.getElementById('viewDescrizione').textContent = evento.descrizione || "Nessuna descrizione fornita.";
    
    const containerAll = document.getElementById('viewAllegatiContainer');
    const listAll = document.getElementById('viewAllegatiList');
    if (listAll) listAll.innerHTML = '';
    
    if(evento.allegati && evento.allegati.length > 0) {
        if(containerAll) containerAll.classList.remove('hidden');
        evento.allegati.forEach(f => {
            if(listAll) listAll.innerHTML += `<a href="${f.url}" target="_blank" class="allegato-link">📎 ${f.name}</a>`;
        });
    } else { 
        if(containerAll) containerAll.classList.add('hidden'); 
    }

    apriModal('modalVisualizzaEvento');
}

// ==========================================
// GESTIONE BACHECA
// ==========================================
function ascoltaComunicazioni() {
    db.collection("bacheca_rappresentanti").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        const lista = document.getElementById('listaComunicazioni');
        if (!lista) return;
        lista.innerHTML = '';
        snapshot.forEach((doc) => {
            const c = doc.data();
            lista.innerHTML += `
                <div class="comunicazione-card">
                    <h4>${c.titolo}</h4>
                    <p class="autore-data">${c.autoreNome}</p>
                    <p class="desc">${c.descrizione || ''}</p>
                    ${c.allegatoUrl ? `<a href="${c.allegatoUrl}" target="_blank" class="allegato-link">📎 ${c.allegatoNome}</a>` : ''}
                </div>`;
        });
    });
}

function caricaCircolariSito() {
    const lista = document.getElementById('listaCircolari');
    if (!lista) return;

    db.collection("circolari_scuola").orderBy("ordine", "asc").onSnapshot((snapshot) => {
        lista.innerHTML = '';

        if (snapshot.empty) {
            lista.innerHTML = `
                <div style="text-align: center; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                    <p style="color: #aaa; margin-bottom: 15px; font-size: 13px;">Nessuna circolare sincronizzata al momento.</p>
                    <a href="https://www.iisgiorgiwoolf.edu.it/gw/circolare/" target="_blank" class="glass-btn-small" style="text-decoration: none; display: inline-block;">
                        Vai al sito dell'Istituto 🔗
                    </a>
                </div>
            `;
            return;
        }

        snapshot.forEach((doc) => {
            const c = doc.data();
            lista.innerHTML += `
                <div class="comunicazione-card">
                    <h4>📄 ${c.titolo}</h4>
                    <p class="autore-data">IIS Giorgi-Woolf</p>
                    <a href="${c.url}" target="_blank" class="allegato-link">Apri Circolare 🔗</a>
                </div>
            `;
        });
    }, (error) => {
        console.error("Errore lettura circolari:", error);
        lista.innerHTML = '<p class="error-message">Errore nel caricamento delle circolari.</p>';
    });
}