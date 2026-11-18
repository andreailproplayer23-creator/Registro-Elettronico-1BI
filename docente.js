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

// Avvio
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
        if (!user) window.location.href = "index.html";
        else {
            document.getElementById('nomeUtenteDisplay').textContent = `${sessionStorage.getItem("nomeUtente")} ${sessionStorage.getItem("cognomeUtente")} (Docente)`;
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

// 1. GENERAZIONE CALENDARIO DEL MESE
function generaCalendario() {
    const grid = document.getElementById('calendarGrid');
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
    let offset = primoGiorno === 0 ? 6 : primoGiorno - 1; // Fa partire da Lunedì
    const giorniNelMese = new Date(anno, mese + 1, 0).getDate();

    for(let i=0; i<offset; i++) grid.innerHTML += `<div class="calendar-day" style="visibility:hidden"></div>`;
    
    for(let i=1; i<=giorniNelMese; i++) {
        let m = (mese+1).toString().padStart(2, '0');
        let d = i.toString().padStart(2, '0');
        let dataStr = `${anno}-${m}-${d}`; // Formato YYYY-MM-DD
        grid.innerHTML += `
            <div class="calendar-day">
                <span class="day-number">${i}</span>
                <div class="events-container" id="events-${dataStr}"></div>
            </div>
        `;
    }
}

// 2. LETTURA EVENTI IN TEMPO REALE DA FIREBASE
function ascoltaEventiAgenda() {
    db.collection("agenda").onSnapshot((snapshot) => {
        document.querySelectorAll('.events-container').forEach(c => c.innerHTML = ''); // Pulisce prima di ricaricare
        snapshot.forEach((doc) => {
            const ev = doc.data();
            const contenitore = document.getElementById(`events-${ev.data}`);
            if(contenitore) {
                const badge = document.createElement('div');
                badge.className = 'evento-badge';
                badge.textContent = ev.tipologia;
                badge.onclick = () => apriDettaglioEvento(doc.id, ev);
                contenitore.appendChild(badge);
            }
        });
    });
}

// 3. VISUALIZZA ED ELIMINA EVENTO
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
    if(evento.autoreUid === auth.currentUser.uid) {
        btnElimina.classList.remove('hidden');
        btnElimina.onclick = () => {
            if(confirm("Vuoi davvero eliminare questo evento?")) {
                db.collection("agenda").doc(id).delete();
                chiudiModal('modalVisualizzaEvento');
            }
        };
    } else {
        btnElimina.classList.add('hidden');
    }
    apriModal('modalVisualizzaEvento');
}

// 4. SALVATAGGIO EVENTO
document.getElementById('formEvento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Salvataggio..."; btn.disabled = true;
    try {
        let fileUrls = [];
        const files = document.getElementById('fileEvento').files;
        for (let i = 0; i < files.length; i++) {
            const snap = await storage.ref(`agenda_allegati/${Date.now()}_${files[i].name}`).put(files[i]);
            fileUrls.push({ name: files[i].name, url: await snap.ref.getDownloadURL() });
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
    } catch (err) { alert("Errore: " + err.message); } 
    finally { btn.textContent = "Salva Evento"; btn.disabled = false; }
});

// 5. LETTURA COMUNICAZIONI RAPPRESENTANTI
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

// 6. SALVATAGGIO COMUNICAZIONI RAPPRESENTANTI
document.getElementById('formAnnuncio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Pubblicazione..."; btn.disabled = true;
    try {
        let url = null, nome = null;
        const file = document.getElementById('fileAnnuncio').files[0];
        if (file) {
            const snap = await storage.ref(`bacheca_allegati/${Date.now()}_${file.name}`).put(file);
            url = await snap.ref.getDownloadURL(); nome = file.name;
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
    } catch (err) { alert("Errore: " + err.message); } 
    finally { btn.textContent = "Pubblica Comunicazione"; btn.disabled = false; }
});

// 7. ESTRAZIONE CIRCOLARI ESTERNE TRAMITE PROXY (DOM Parsing)
async function caricaCircolariSito() {
    const lista = document.getElementById('listaCircolari');
    try {
        const target = encodeURIComponent('https://www.iisgiorgiwoolf.edu.it/gw/circolare/');
        // Usa un proxy legale CORS per leggere la pagina
        const res = await fetch(`https://api.allorigins.win/get?url=${target}`);
        const data = await res.json();
        
        const doc = new DOMParser().parseFromString(data.contents, 'text/html');
        // Estrae tutti i link che contengono la parola circolare
        const links = Array.from(doc.querySelectorAll('a')).filter(a => a.textContent.toLowerCase().includes('circolare'));
        
        lista.innerHTML = '';
        if(links.length === 0) lista.innerHTML = '<p class="info-text">Nessuna circolare trovata sul sito in questo momento.</p>';
        
        // Prende le prime 15
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
    } catch (error) {
        lista.innerHTML = '<p class="error-message">Non riesco a collegarmi al sito della scuola in questo momento.</p>';
    }
}