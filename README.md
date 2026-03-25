# voco-place-react

Reaalajaline pikslitahvel, kus frontend suhtleb backendiga Socket.IO kaudu ja tahvli olek salvestatakse SQLite andmebaasi.

## Projekti osad

- `frontend/` – Vite + React kasutajaliides
- `backend/` – Express + Socket.IO + Sequelize + SQLite server
- `test/` – koormus- ja simulatsioonitestid

## Eeldused

- Node.js
- npm

## Paigaldus

Paigalda sõltuvused igas kasutatavas kaustas eraldi.

### Frontend

```bash
cd frontend
npm install
```

### Backend

```bash
cd backend
npm install
```

### Testid

```bash
cd test
npm install
```

## Kuidas süsteem tööle panna

Süsteem koosneb vähemalt kahest protsessist: backend ja frontend.

### 1. Käivita backend

```bash
cd backend
node server.js
```

Või:

```bash
cd backend
npm start
```

Backend teeb järgmist:

- käivitab serveri pordil `3000`
- loob Socket.IO ühendused
- ühendub SQLite andmebaasiga
- laeb tahvli andmed mällu

Kui kõik töötab, peaksid nägema umbes selliseid logisid:

```text
Andmebaas ühendatud!
Backend töötab pordil 3000
```

### 2. Käivita frontend

```bash
cd frontend
npm run dev
```

Frontend töötab vaikimisi aadressil:

```text
http://localhost:5173
```

Frontend ühendub backendiga aadressil `http://localhost:3000`.

### 3. Ava rakendus brauseris

Ava:

```text
http://localhost:5173
```

Kui backend ja frontend töötavad, peaksid nägema pikslitahvlit ning ühenduse staatust.

## Testide käivitamine

Testid eeldavad, et backend juba töötab.

### Tavaline koormustest

```bash
cd test
node loadTest.js
```

See test:

- käivitab vaikimisi 20 simuleeritud kasutajat
- laseb neil tegutseda 30 sekundit
- kogub RTT, CPU ja RAM mõõdikuid
- värvib lõpus testis muudetud pikslid tagasi valgeks

Näide kohandatud käivituseks:

```bash
node loadTest.js --users 200 --duration 30 --connect-wait 20 --ramp-up 10
```

### Pidev juhuslik koormustest

```bash
cd test
node loadContinousTest.js
```

See test erineb tavalisest selle poolest, et kasutajad ei tegutse ühtlase intervalliga, vaid iga kasutaja teeb järgmise tegevuse juhuslikul ajal.

Näide:

```bash
node loadContinousTest.js --users 50 --duration 20 --min-delay 100 --max-delay 1200
```

Või npm scriptiga:

```bash
cd test
npm run test:continuous
```

## Olulised pordid

- `3000` – backend
- `5173` – frontend

## Levinud probleemid

### Port `3000` on juba kasutuses

Kui backend käivitamisel tuleb `EADDRINUSE`, siis mõni teine protsess juba kasutab porti `3000`.

### Frontend ei käivitu käsuga `npm start`

Frontend kasutab Vite'i, seega õige käsk on:

```bash
npm run dev
```

### Test ei saa ühendust

Kontrolli, et backend jookseb enne testide käivitamist.

## Märkused

- Backend andmebaas salvestatakse faili `backend/database.sqlite`
- Testid puhastavad enda loodud pikslid lõpus tagasi valgeks
- Projektis on olemas ka vana juurprojekti React struktuur, kuid aktiivne kasutajaliides jookseb kaustast `frontend/`
