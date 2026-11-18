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
firebase.initializeApp(firebaseConfig);
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
    e.preventDefault(); // Evita il ricaricamento della pagina
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // UI Feedback
    errorMessage.textContent = "";
    loginBtn.classList.add('hidden');
    loader.classList.remove('hidden');

    // Autenticazione Firebase
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            // Va a cercare il ruolo nel database Firestore
            db.collection("utenti").doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        
                        // Salva nome e cognome nel browser per mostrarli nell'header in alto a destra
                        sessionStorage.setItem("nomeUtente", userData.nome);
                        sessionStorage.setItem("cognomeUtente", userData.cognome);
                        sessionStorage.setItem("ruoloUtente", userData.ruolo);

                        // Smistamento in base al ruolo
                        if (userData.ruolo === "docente") {
                            window.location.href = "docente.html";
                        } else if (userData.ruolo === "studente") {
                            window.location.href = "studente.html";
                        } else if (userData.ruolo === "admin") {
                            window.location.href = "admin.html";
                        } else {
                            showError("Ruolo non riconosciuto nel database.");
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