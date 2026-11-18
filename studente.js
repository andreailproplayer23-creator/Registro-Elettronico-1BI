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

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (!user) window.location.href = "index.html";
        else {
            document.getElementById('nomeUtenteDisplay').textContent = `${sessionStorage.getItem("nomeUtente")} ${sessionStorage.getItem("cognomeUtente")} (Studente)`;
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

function generaCalendario() {
    // Sostituisci 'calendarGrid' con la classe se l'ID non c'è nello studente.html
    const grid = document.querySelector('.calendar-grid');
    grid.innerHTML = `
        <div class="calendar-day header">LUN</div><div class="calendar-day header">MAR</div>
        <div class="calendar-day header">MER</div><div class="calendar-day header">GIO</div>
        <div class="calendar-day header">VEN</div><div class="calendar-day header">SAB</div>
        <div class="calendar-day header">DOM</div>
    `;
    const oggi = new Date();
    const anno = oggi.getFullYear();
    const mese = oggi.getMonth();
    let primoGiorno = new Date(anno, mese, 1).getDay();
    let offset = primoGiorno === 0 ? 6 : primoGiorno - 1; 
    const giorniNelMese = new Date(anno, mese + 1, 0).getDate();

    for(let i=0; i<offset; i++) grid.innerHTML += `<div class="calendar-day" style="visibility:hidden"></div>`;
    
    for(let i=1; i<=giorniNelMese; i++) {
        let m = (mese+1).toString().padStart(2, '0');
        let d = i.toString().padStart(2, '0');
        let dataStr = `${anno}-${m}-${d}`; 
        grid.innerHTML += `
            <div class="calendar-day">
                <span class="day-number">${i}</span>
                <div class="events-container" id="events-${dataStr}"></div>
            </div>
        `;
    }
}

function ascoltaEventiAgenda() {
    db.collection("agenda").onSnapshot((snapshot) => {
        document.querySelectorAll('.events-container').forEach(c => c.innerHTML = ''); 
        snapshot.forEach((doc) => {
            const ev = doc.data();
            const contenitore = document.getElementById(`events-${ev.data}`);
            if(contenitore) {
                const badge = document.createElement('div');
                badge.className = 'evento-badge';
                badge.textContent = ev.tipologia;
                badge.onclick = () => apriDettaglioEvento(ev);
                contenitore.appendChild(badge);
            }
        });
    });
}

// Sola visualizzazione per lo studente
function apriDettaglioEvento(evento) {
    document.getElementById('viewTipoEvento').textContent = evento.tipologia;
    // Se viewAutore o data esistono nel vecchio html, usa quelli, altrimenti gestiamo l'errore:
    try {
        document.getElementById('viewAutore').textContent = evento.autoreNome;
        document.getElementById('viewData').textContent = evento.data;
        document.getElementById('viewOrario').textContent = evento.tuttaGiornata ? `Tutta la giornata` : `${evento.oraInizio} - ${evento.oraFine}`;
    } catch(e) {} // Fallback se ID leggermente diversi
    
    document.getElementById('viewDescrizione').textContent = evento.descrizione || "Nessuna descrizione.";
    
    const containerAll = document.getElementById('viewAllegatiContainer');
    const listAll = document.getElementById('viewAllegatiList');
    listAll.innerHTML = '';
    
    if(evento.allegati && evento.allegati.length > 0) {
        containerAll.classList.remove('hidden');
        evento.allegati.forEach(f => listAll.innerHTML += `<a href="${f.url}" target="_blank" class="allegato-link">📎 ${f.name}</a>`);
    } else { containerAll.classList.add('hidden'); }

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
                    <h4>${c.titolo}</h4>
                    <p class="autore-data">${c.autoreNome}</p>
                    <p class="desc">${c.descrizione || ''}</p>
                    ${c.allegatoUrl ? `<a href="${c.allegatoUrl}" target="_blank" class="allegato-link">📎 ${c.allegatoNome}</a>` : ''}
                </div>`;
        });
    });
}

async function caricaCircolariSito() {
    const lista = document.getElementById('listaCircolari');
    try {
        const target = encodeURIComponent('https://www.iisgiorgiwoolf.edu.it/gw/circolare/');
        const res = await fetch(`https://api.allorigins.win/get?url=${target}`);
        const data = await res.json();
        const doc = new DOMParser().parseFromString(data.contents, 'text/html');
        const links = Array.from(doc.querySelectorAll('a')).filter(a => a.textContent.toLowerCase().includes('circolare'));
        
        lista.innerHTML = '';
        if(links.length === 0) lista.innerHTML = '<p class="info-text">Nessuna circolare trovata sul sito.</p>';
        links.slice(0, 15).forEach(link => {
            const urlReale = link.href.startsWith('http') ? link.href : `https://www.iisgiorgiwoolf.edu.it${link.getAttribute('href')}`;
            lista.innerHTML += `
                <div class="comunicazione-card">
                    <h4>📄 ${link.textContent.trim()}</h4>
                    <p class="autore-data">Dal sito dell'Istituto</p>
                    <a href="${urlReale}" target="_blank" class="allegato-link">Apri Circolare 🔗</a>
                </div>
            `;
        });
    } catch (error) { lista.innerHTML = '<p class="error-message">Impossibile caricare le circolari.</p>'; }
}