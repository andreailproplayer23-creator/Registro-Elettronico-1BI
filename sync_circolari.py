import requests
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime, timezone
import time

# --- Configurazione Firebase ---
PROJECT_ID = "registro-elettronico-1bi"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/circolari_scuola"

URL_BASE = "https://www.iisgiorgiwoolf.edu.it"
URL_CATEGORIE = f"{URL_BASE}/gw/circolare/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def estrai_dettagli_circolare(url_dettaglio):
    """Visita la pagina della singola circolare ed estrae i dettagli reali."""
    try:
        res = requests.get(url_dettaglio, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        
        # Estrai il titolo reale (solitamente in h1 o h2 nella pagina di dettaglio)
        titolo = "Titolo non trovato"
        titolo_tag = soup.find('h1') or soup.find('h2', class_='titolo-circolare') # Adatta la classe se necessario
        if titolo_tag:
            titolo = titolo_tag.get_text(strip=True)
            
        # Estrai il numero (se presente nel titolo o in un campo specifico)
        numero = ""
        numero_tag = soup.find(string=lambda t: t and "Circolare" in t and any(char.isdigit() for char in t))
        if numero_tag:
            numero = numero_tag.strip()
            
        # Estrai la descrizione
        descrizione = ""
        # Cerca un paragrafo subito dopo il titolo, o un div con la descrizione
        desc_tag = soup.find('p', class_='descrizione-circolare') or soup.find('div', class_='contenuto').find('p') if soup.find('div', class_='contenuto') else None
        if desc_tag:
             descrizione = desc_tag.get_text(strip=True)
             
        # Cerca il link al PDF
        link_pdf = url_dettaglio # Default alla pagina se non trova il PDF
        links = soup.find_all('a', href=True)
        for link in links:
            href = link['href']
            # Cerca link che finiscono in .pdf o che hanno una classe/testo indicativa
            if href.lower().endswith('.pdf') or 'allegato' in href.lower() or 'download' in href.lower():
                link_pdf = URL_BASE + href if href.startswith('/') else href
                break # Prende il primo link PDF trovato

        return {
            "numero": numero,
            "titolo": titolo,
            "descrizione": descrizione,
            "url": link_pdf
        }
    except Exception as e:
        print(f"Errore nel recupero dettagli da {url_dettaglio}: {e}")
        return None

def estrai_circolari():
    circolari_trovate = []
    
    try:
        print("Scaricamento pagina categorie...")
        res_cat = requests.get(URL_CATEGORIE, headers=HEADERS, timeout=15)
        res_cat.raise_for_status()
        soup_cat = BeautifulSoup(res_cat.text, "html.parser")
        
        link_categorie = []
        for a in soup_cat.find_all('a', href=True):
            if '/gw/tipologia-circolare/' in a['href']:
                href = URL_BASE + a['href'] if a['href'].startswith('/') else a['href']
                if href not in link_categorie:
                    link_categorie.append(href)

        print(f"Trovate {len(link_categorie)} categorie da esplorare.")

        for url_cat in link_categorie[:3]: 
            print(f"Esplorando categoria: {url_cat}")
            res_lista = requests.get(url_cat, headers=HEADERS, timeout=15)
            soup_lista = BeautifulSoup(res_lista.text, "html.parser")
            
            # Cerca i link alle singole circolari
            cards = soup_lista.find_all('article', class_='card-bg') or soup_lista.find_all('div', class_='card')

            for card in cards:
                try:
                    link_tag = card.find('a', href=True)
                    if not link_tag: continue
                    
                    url_dettaglio = URL_BASE + link_tag['href'] if link_tag['href'].startswith('/') else link_tag['href']
                    
                    print(f"Estrazione dettagli da: {url_dettaglio}")
                    dettagli = estrai_dettagli_circolare(url_dettaglio)
                    
                    if dettagli:
                         dettagli["timestamp_estrazione"] = datetime.now(timezone.utc).isoformat()
                         circolari_trovate.append(dettagli)
                    
                    if len(circolari_trovate) >= 15:
                        break
                        
                except Exception as e:
                    print(f"Errore parsing singola card: {e}")
                    
            if len(circolari_trovate) >= 15:
                break
                
            time.sleep(1)

    except Exception as e:
        print(f"Errore generale: {e}")

    return circolari_trovate

def salva_su_firebase(circolari):
    if not circolari:
        print("Nessuna circolare valida trovata da salvare.")
        return

    for idx, circ in enumerate(circolari):
        doc_id = hashlib.md5(f"{circ.get('numero', '')}{circ['titolo']}".encode('utf-8')).hexdigest()
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
            print(f"[OK] Sincronizzata: {circ.get('numero', '')} - {circ['titolo'][:30]}...")
        else:
            print(f"[ERRORE] {res.status_code}: {res.text}")

if __name__ == "__main__":
    print("Inizio scansione profonda circolari (con estrazione dettagli)...")
    lista = estrai_circolari()
    print(f"Trovate {len(lista)} circolari. Avvio salvataggio su Firebase...")
    salva_su_firebase(lista)
    print("Operazione conclusa.")