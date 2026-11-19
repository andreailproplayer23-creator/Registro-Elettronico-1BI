import requests
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime, timezone

# Configurazione Firebase (presa dai tuoi file JS)
PROJECT_ID = "registro-elettronico-1bi"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/circolari_scuola"
URL_CIRCOLARI = "https://www.iisgiorgiwoolf.edu.it/gw/circolare/"

def estrai_circolari():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get(URL_CIRCOLARI, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Errore di connessione al sito della scuola: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    items = soup.find_all(['div', 'article'], class_=lambda c: c and 'card' in c)
    
    circolari = []
    link_visti = set()

    for item in items:
        link_tag = item.find('a')
        if link_tag and 'href' in link_tag.attrs:
            title = link_tag.get_text(separator=" ", strip=True)
            link = link_tag['href'].strip()
            
            if link.startswith('/'):
                link = "https://www.iisgiorgiwoolf.edu.it" + link
                
            if len(title) > 5 and link not in link_visti and not link.endswith('/circolare/'):
                link_visti.add(link)
                circolari.append({"titolo": title, "url": link})
                
            # Prendiamo le ultime 15 circolari
            if len(circolari) >= 15:
                break
                
    return circolari

def salva_su_firebase(circolari):
    if not circolari:
        print("Nessuna circolare estratta.")
        return

    for idx, circ in enumerate(circolari):
        # Creiamo un ID univoco basato sull'URL così non crea mai duplicati su Firestore
        doc_id = hashlib.md5(circ["url"].encode('utf-8')).hexdigest()
        doc_url = f"{FIRESTORE_URL}/{doc_id}"
        
        payload = {
            "fields": {
                "titolo": {"stringValue": circ["titolo"]},
                "url": {"stringValue": circ["url"]},
                "ordine": {"integerValue": str(idx)},
                "aggiornatoIl": {"timestampValue": datetime.now(timezone.utc).isoformat()}
            }
        }
        
        res = requests.patch(doc_url, json=payload)
        if res.status_code == 200:
            print(f"[OK] Sincronizzata: {circ['titolo'][:50]}...")
        else:
            print(f"[ERRORE] {res.status_code}: {res.text}")

if __name__ == "__main__":
    print("Avvio sincronizzazione circolari verso il Registro 1BI...")
    lista = estrai_circolari()
    salva_su_firebase(lista)
    print("Sincronizzazione completata.")