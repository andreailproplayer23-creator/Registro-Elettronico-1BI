import requests
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime, timezone
import time
import re

# --- Configurazione Firebase ---
PROJECT_ID = "registro-elettronico-1bi"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/circolari_scuola"

URL_BASE = "https://www.iisgiorgiwoolf.edu.it"
URL_START = f"{URL_BASE}/gw/circolare/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def ottieni_dettagli_circolare(url_circolare):
    """Visita la singola circolare ed estrae i dati reali e il PDF."""
    try:
        res = requests.get(url_circolare, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        
        # 1. Trova il Titolo (solitamente h1)
        titolo_tag = soup.find('h1')
        titolo = titolo_tag.get_text(strip=True) if titolo_tag else "Titolo non trovato"
        
        # 2. Cerca il numero della circolare nel testo della pagina
        testo_pagina = soup.get_text(separator=' ', strip=True)
        numero = ""
        match = re.search(r'(Circolare|circ\.?)\s*n\.?\s*(\d+)', testo_pagina, re.IGNORECASE)
        if match:
            numero = match.group(0)

        # 3. Trova una breve descrizione
        descrizione = ""
        p_tags = soup.find_all('p')
        for p in p_tags:
            testo_p = p.get_text(strip=True)
            # Prendi il primo paragrafo sensato che non sia un testo di sistema
            if len(testo_p) > 20 and "allegat" not in testo_p.lower() and "stampa" not in testo_p.lower():
                descrizione = testo_p
                break

        # 4. Cerca specificamente il link al documento PDF
        link_pdf = url_circolare
        for a in soup.find_all('a', href=True):
            href = a['href']
            testo_link = a.get_text(strip=True).lower()
            if href.lower().endswith('.pdf') or 'scarica' in testo_link or 'allegato' in testo_link:
                link_pdf = URL_BASE + href if href.startswith('/') else href
                if link_pdf.lower().endswith('.pdf'):
                    break # Se troviamo un vero .pdf, fermiamo la ricerca
                    
        return {
            "numero": numero,
            "titolo": titolo,
            "descrizione": descrizione[:150] + "..." if len(descrizione) > 150 else descrizione,
            "url": link_pdf,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        print(f"Errore nell'estrazione di {url_circolare}: {e}")
        return None

def estrai_circolari():
    circolari = []
    links_visitati = set()
    
    try:
        print("Ricerca categorie in corso...")
        res_start = requests.get(URL_START, headers=HEADERS, timeout=10)
        soup_start = BeautifulSoup(res_start.text, "html.parser")
        
        link_categorie = set()
        for a in soup_start.find_all('a', href=True):
            if '/gw/tipologia-circolare/' in a['href']:
                href = URL_BASE + a['href'] if a['href'].startswith('/') else a['href']
                link_categorie.add(href)
                
        link_circolari = []
        for url_cat in list(link_categorie)[:3]:
            print(f"Analizzo categoria: {url_cat}")
            res_cat = requests.get(url_cat, headers=HEADERS, timeout=10)
            soup_cat = BeautifulSoup(res_cat.text, "html.parser")
            
            # Filtro critico: Cerchiamo SOLO i link che portano a singole circolari, non alle categorie
            for a in soup_cat.find_all('a', href=True):
                href = a['href']
                if '/gw/circolare/' in href and '/tipologia-circolare/' not in href and href != '/gw/circolare/':
                    url_completo = URL_BASE + href if href.startswith('/') else href
                    if url_completo not in links_visitati:
                        links_visitati.add(url_completo)
                        link_circolari.append(url_completo)
        
        print(f"Trovate {len(link_circolari)} CIRCOLARI REALI. Inizio il download dei dati...")
        
        for url_circ in link_circolari[:15]: 
            dati = ottieni_dettagli_circolare(url_circ)
            if dati and dati["titolo"] != "Titolo non trovato":
                circolari.append(dati)
            time.sleep(0.5)
            
    except Exception as e:
        print(f"Errore: {e}")
        
    return circolari

def salva_su_firebase(circolari):
    if not circolari:
        print("Nessuna circolare da salvare.")
        return

    for idx, circ in enumerate(circolari):
        # Genera un ID univoco basato sul titolo per evitare duplicati
        doc_id = hashlib.md5(circ["titolo"].encode('utf-8')).hexdigest()
        doc_url = f"{FIRESTORE_URL}/{doc_id}"
        
        payload = {
            "fields": {
                "numero": {"stringValue": circ.get("numero", "")},
                "titolo": {"stringValue": circ.get("titolo", "")},
                "descrizione": {"stringValue": circ.get("descrizione", "")},
                "url": {"stringValue": circ.get("url", "")},
                "ordine": {"integerValue": str(idx)},
                "aggiornatoIl": {"timestampValue": circ["timestamp"]}
            }
        }
        
        requests.patch(doc_url, json=payload)
        print(f"[OK] Salvata: {circ.get('numero', '')} {circ['titolo'][:30]}...")

if __name__ == "__main__":
    lista = estrai_circolari()
    salva_su_firebase(lista)
    print("Fine sincronizzazione.")