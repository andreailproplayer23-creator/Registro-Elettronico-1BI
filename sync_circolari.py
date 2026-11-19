import requests
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime, timezone
import time
import re

PROJECT_ID = "registro-elettronico-1bi"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/circolari_scuola"
URL_BASE = "https://www.iisgiorgiwoolf.edu.it"
URL_START = f"{URL_BASE}/gw/circolare/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def ottieni_dettagli_circolare(url_circolare):
    try:
        res = requests.get(url_circolare, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        
        titolo_tag = soup.find('h1')
        titolo = titolo_tag.get_text(strip=True) if titolo_tag else "Titolo non trovato"
        
        # Estrazione Numero più robusta
        numero = ""
        testo_pagina = soup.get_text(separator=' ', strip=True)
        # Cerca nel titolo o nel testo
        match = re.search(r'(Circolare|circ\.?)\s*n\.?\s*(\d+)', titolo + " " + testo_pagina, re.IGNORECASE)
        if match:
            numero = f"Circ. n.{match.group(2)}"

        descrizione = ""
        p_tags = soup.find_all('p')
        for p in p_tags:
            testo_p = p.get_text(strip=True)
            if len(testo_p) > 20 and "allegat" not in testo_p.lower() and "stampa" not in testo_p.lower():
                descrizione = testo_p
                break

        link_pdf = url_circolare
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.lower().endswith('.pdf') or 'scarica' in a.get_text(strip=True).lower():
                link_pdf = URL_BASE + href if href.startswith('/') else href
                if link_pdf.lower().endswith('.pdf'):
                    break 
                    
        return {
            "numero": numero,
            "titolo": titolo,
            "descrizione": descrizione[:150] + "..." if len(descrizione) > 150 else descrizione,
            "url": link_pdf,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        print(f"Errore su {url_circolare}: {e}")
        return None

def estrai_circolari():
    circolari = []
    links_visitati = set()
    
    try:
        print("Ricerca categorie A.S. 2026/2027 in corso...")
        res_start = requests.get(URL_START, headers=HEADERS, timeout=10)
        soup_start = BeautifulSoup(res_start.text, "html.parser")
        
        link_categorie = set()
        for a in soup_start.find_all('a', href=True):
            href = a['href']
            # FILTRO CRITICO: Prende solo le categorie dell'anno 2026-2027
            if '/gw/tipologia-circolare/' in href and '2026-2027' in href:
                url_cat = URL_BASE + href if href.startswith('/') else href
                link_categorie.add(url_cat)
                
        link_circolari = []
        for url_cat in list(link_categorie):
            print(f"Analizzo categoria: {url_cat}")
            res_cat = requests.get(url_cat, headers=HEADERS, timeout=10)
            soup_cat = BeautifulSoup(res_cat.text, "html.parser")
            
            for a in soup_cat.find_all('a', href=True):
                href = a['href']
                if '/gw/circolare/' in href and '/tipologia-circolare/' not in href and href != '/gw/circolare/':
                    url_completo = URL_BASE + href if href.startswith('/') else href
                    if url_completo not in links_visitati:
                        links_visitati.add(url_completo)
                        link_circolari.append(url_completo)
        
        print(f"Trovate {len(link_circolari)} circolari. Inizio download dati...")
        
        for url_circ in link_circolari[:15]: 
            dati = ottieni_dettagli_circolare(url_circ)
            if dati and dati["titolo"] != "Titolo non trovato":
                circolari.append(dati)
            time.sleep(0.5)
            
    except Exception as e:
        print(f"Errore: {e}")
        
    return circolari

def salva_su_firebase(circolari):
    for idx, circ in enumerate(circolari):
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