// INSERITE QUI I DATI DAL VOSTRO api.txt
const firebaseConfig = {
  apiKey: "AIzaSyC3B-HBxOB020rKQTOLZQ1GrLbTP7zf_gk",
  authDomain: "registro-elettronico-1bi.firebaseapp.com",
  projectId: "registro-elettronico-1bi",
  storageBucket: "registro-elettronico-1bi.firebasestorage.app",
  messagingSenderId: "467293141486",
  appId: "1:467293141486:web:f8ee3f8fe8c1a092ef76ff"
};

// Inizializza Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Elementi del DOM
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.getElementById('loginBtn');
const loader = document.getElementById('loader');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault(); 
    
    // Pulisci le sessioni precedenti per evitare conflitti o cache vecchie
    sessionStorage.clear();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // UI Feedback
    errorMessage.textContent = "";
    loginBtn.classList.add('hidden');
    loader.classList.remove('hidden');

    // Autenticazione Firebase
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            // Cerca il ruolo in Firestore
            db.collection("utenti").doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        
                        // Assicuriamoci che il ruolo sia letto bene (niente spazi, tutto minuscolo)
                        const ruolo = (userData.ruolo || "docente").toLowerCase().trim();
                        
                        // Salva in sessione
                        sessionStorage.setItem("nomeUtente", userData.nome);
                        sessionStorage.setItem("cognomeUtente", userData.cognome);
                        sessionStorage.setItem("ruoloUtente", ruolo);

                        // Smistamento preciso
                        if (ruolo === "admin") {
                            window.location.href = "admin.html";
                        } else if (ruolo === "studente") {
                            window.location.href = "studente.html";
                        } else {
                            window.location.href = "docente.html"; // Default
                        }
                    } else {
                        showError("Profilo database non trovato. Contatta l'amministratore.");
                    }
                })
                .catch((error) => {
                    showError("Errore durante il recupero dei dati: " + error.message);
                });
        })
        .catch((error) => {
            let errorMsg = "Credenziali non valide.";
            if (error.code === 'auth/user-not-found') errorMsg = "Utente non trovato.";
            if (error.code === 'auth/wrong-password') errorMsg = "Password errata.";
            showError(errorMsg);
        });
});

function showError(msg) {
    errorMessage.textContent = msg;
    loader.classList.add('hidden');
    loginBtn.classList.remove('hidden');
}