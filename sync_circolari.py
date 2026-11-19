import requests
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime, timezone
import time

# --- Configurazione Firebase ---
PROJECT_ID = "registro-elettronico-1bi"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/circolari_scuola"

# URL di partenza (La pagina con le categorie mostrata nello screen)
URL_BASE = "https://www.iisgiorgiwoolf.edu.it"
URL_CATEGORIE = f"{URL_BASE}/gw/circolare/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def ottieni_link_pdf(url_dettaglio):
    """Visita la pagina della singola circolare e cerca il link al PDF."""
    try:
        res = requests.get(url_dettaglio, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        # Cerca link che finiscono in .pdf o che hanno testo tipo "Scarica", "Allegato"
        links = soup.find_all('a', href=True)
        for link in links:
            href = link['href']
            if href.lower().endswith('.pdf'):
                return URL_BASE + href if href.startswith('/') else href
        return url_dettaglio # Se non trova il PDF, ritorna la pagina di dettaglio
    except Exception as e:
        print(f"Errore nel recupero PDF da {url_dettaglio}: {e}")
        return url_dettaglio

def estrai_circolari():
    circolari_trovate = []
    
    try:
        # 1. Ottieni la pagina delle categorie
        print("Scaricamento pagina categorie...")
        res_cat = requests.get(URL_CATEGORIE, headers=HEADERS, timeout=15)
        res_cat.raise_for_status()
        soup_cat = BeautifulSoup(res_cat.text, "html.parser")
        
        # Trova i link alle categorie (es. "Circolari per alunni 2026/2027")
        link_categorie = []
        for a in soup_cat.find_all('a', href=True):
            if '/gw/tipologia-circolare/' in a['href']:
                href = URL_BASE + a['href'] if a['href'].startswith('/') else a['href']
                if href not in link_categorie:
                    link_categorie.append(href)

        print(f"Trovate {len(link_categorie)} categorie da esplorare.")

        # 2. Esplora le prime 2/3 categorie più recenti per estrarre le card
        for url_cat in link_categorie[:3]: 
            print(f"Esplorando categoria: {url_cat}")
            res_lista = requests.get(url_cat, headers=HEADERS, timeout=15)
            soup_lista = BeautifulSoup(res_lista.text, "html.parser")
            
            # Cerca le card delle circolari (la struttura vista nel secondo screenshot)
            cards = soup_lista.find_all('article', class_='card-bg') # Assumiamo che le card abbiano questa classe (tipica dei siti scolastici MIUR)
            if not cards:
                # Fallback: cerca i div che sembrano card
                cards = soup_lista.find_all('div', class_='card')

            for card in cards:
                try:
                    # Estrazione dati base dalla card
                    titolo_tag = card.find(['h3', 'h4', 'h5', 'a'])
                    if not titolo_tag: continue
                    
                    titolo = titolo_tag.get_text(strip=True)
                    
                    # Cerca il numero (es. "circ. n.176")
                    numero_tag = card.find(string=lambda t: t and "circ. n." in t.lower())
                    numero = numero_tag.strip() if numero_tag else ""
                    
                    # Cerca la descrizione
                    desc_tag = card.find('p')
                    descrizione = desc_tag.get_text(strip=True) if desc_tag else ""
                    
                    # Costruisci l'URL di dettaglio
                    link_tag = card.find('a', href=True)
                    url_dettaglio = URL_BASE + link_tag['href'] if link_tag and link_tag['href'].startswith('/') else (link_tag['href'] if link_tag else url_cat)

                    # 3. Vai a cercare il PDF effettivo
                    link_pdf = ottieni_link_pdf(url_dettaglio)

                    circolari_trovate.append({
                        "numero": numero,
                        "titolo": titolo,
                        "descrizione": descrizione,
                        "url": link_pdf,
                        # Usiamo un timestamp fittizio per l'ordinamento, assumendo che i primi siano i più recenti
                        "timestamp_estrazione": datetime.now(timezone.utc).isoformat() 
                    })
                    
                    if len(circolari_trovate) >= 15: # Limite di 15 circolari totali
                        break
                        
                except Exception as e:
                    print(f"Errore parsing singola card: {e}")
                    
            if len(circolari_trovate) >= 15:
                break
                
            time.sleep(1) # Pausa per non sovraccaricare il server scolastico

    except Exception as e:
        print(f"Errore generale: {e}")

    return circolari_trovate

def salva_su_firebase(circolari):
    if not circolari:
        print("Nessuna circolare valida trovata da salvare.")
        return

    for idx, circ in enumerate(circolari):
        # ID univoco basato sul titolo per evitare duplicati
        doc_id = hashlib.md5(circ["titolo"].encode('utf-8')).hexdigest()
        doc_url = f"{FIRESTORE_URL}/{doc_id}"
        
        payload = {
            "fields": {
                "numero": {"stringValue": circ.get("numero", "")},
                "titolo": {"stringValue": circ.get("titolo", "")},
                "descrizione": {"stringValue": circ.get("descrizione", "")},
                "url": {"stringValue": circ.get("url", "")},
                "ordine": {"integerValue": str(idx)},
                "aggiornatoIl": {"timestampValue": circ["timestamp_estrazione"]}
            }
        }
        
        res = requests.patch(doc_url, json=payload)
        if res.status_code == 200:
            print(f"[OK] Sincronizzata: {circ['numero']} - {circ['titolo'][:30]}...")
        else:
            print(f"[ERRORE] {res.status_code}: {res.text}")

if __name__ == "__main__":
    print("Inizio scansione profonda circolari...")
    lista = estrai_circolari()
    print(f"Trovate {len(lista)} circolari. Avvio salvataggio su Firebase...")
    salva_su_firebase(lista)
    print("Operazione conclusa.")