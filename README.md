# Gotisk Transskription App

En web-app til at transskribere 1600-tals dansk gotisk skrift til moderne dansk.

## Funktioner

- Upload billeder af gotiske dokumenter
- Automatisk transskription med Claude Vision AI
- Rediger transskriptioner direkte i browseren
- Gem transskriptioner til Supabase database
- Eksportér som TXT-filer
- Virker fuldt online - ingen installation påkrævet

## Opsætning

### 1. Claude API Nøgle

1. Gå til https://console.anthropic.com/settings/keys
2. Opret en ny API-nøgle
3. Kopiér nøglen (starter med `sk-ant-...`)

### 2. Supabase (Valgfrit - for at gemme transskriptioner)

1. Gå til https://supabase.com
2. Log ind med din konto
3. Vælg dit projekt (eller opret nyt)
4. Gå til Settings → API
5. Kopiér:
   - **Project URL** (f.eks. `https://xxx.supabase.co`)
   - **anon public** nøglen

#### Opret database-tabel i Supabase

Kør følgende SQL i Supabase SQL Editor:

```sql
CREATE TABLE transcriptions (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  original_text TEXT,
  edited_text TEXT NOT NULL,
  image_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (tillad alt for denne simple app)
CREATE POLICY "Allow all operations" ON transcriptions
FOR ALL
USING (true)
WITH CHECK (true);
```

### 3. Første gang du åbner appen

1. Appen vil bede om dine API-nøgler
2. Indtast Claude API-nøglen (påkrævet)
3. Indtast Supabase URL og nøgle (valgfrit - hvis du vil gemme online)
4. Klik "Gem konfiguration"
5. Nøglerne gemmes sikkert i din browser (localStorage)

## Brug

1. **Upload billede**: Klik på upload-området eller træk et billede ind
2. **Transskribér**: Klik "Transskribér" for at bruge AI til at læse teksten
3. **Rediger**: Ret eventuelle fejl direkte i tekstfeltet
4. **Gem**: Klik "Gem" for at gemme til database
5. **Eksportér**: Klik "Eksportér TXT" for at downloade som fil

## Deploy til Netlify

### Metode 1: Via GitHub (Anbefalet)

1. **Opret GitHub repository:**
   ```bash
   cd /Users/ditteflamsholt/Documents/Niels/gotisk-transskription-app
   git init
   git add .
   git commit -m "Initial commit: Gotisk transskription app"
   gh repo create gotisk-transskription --public --source=. --remote=origin --push
   ```

2. **Deploy til Netlify:**
   - Gå til https://app.netlify.com
   - Log ind med din konto
   - Klik "Add new site" → "Import an existing project"
   - Vælg "GitHub"
   - Vælg dit `gotisk-transskription` repository
   - Klik "Deploy site"

3. **Få din URL:**
   - Netlify giver dig en URL som `https://xxx.netlify.app`
   - Du kan ændre den til et bedre navn under Site settings → Domain management

### Metode 2: Via Netlify CLI

```bash
# Installer Netlify CLI hvis ikke allerede installeret
npm install -g netlify-cli

# Gå til projektmappen
cd /Users/ditteflamsholt/Documents/Niels/gotisk-transskription-app

# Log ind på Netlify
netlify login

# Deploy
netlify deploy --prod
```

### Metode 3: Drag & Drop

1. Gå til https://app.netlify.com/drop
2. Træk hele `gotisk-transskription-app` mappen ind
3. Appen bliver uploadet og får en URL

## Dele med din partner

1. Send partneren URL'en fra Netlify (f.eks. `https://gotisk-transskription.netlify.app`)
2. Første gang partneren åbner siden skal de indtaste API-nøglerne
3. Partneren kan derefter bruge appen fuldstændigt uafhængigt

**Vigtigt:** Hvis I bruger Supabase, gemmer I begge til samme database og kan se hinandens gemte transskriptioner.

## Omkostninger

- **Netlify hosting**: Gratis
- **Supabase database**: Gratis (op til 500MB database + 1GB båndbredde)
- **Claude API**: Ca. 0.50-1.50 kr per transskriberet side

## Fejlfinding

### "API request failed"
- Tjek at din Claude API-nøgle er korrekt
- Tjek at du har tilstrækkelig kredit på din Anthropic-konto

### Kan ikke gemme til Supabase
- Tjek at Supabase URL og nøgle er korrekte
- Tjek at du har oprettet `transcriptions` tabellen (se opsætning)
- Transskriptioner gemmes lokalt i browseren hvis Supabase fejler

### Appen virker ikke efter deployment
- Åbn browser-konsollen (F12) og tjek for fejl
- Sørg for at alle filer er uploadet korrekt

## Filer i projektet

- `index.html` - Hovedsiden
- `styles.css` - Design og layout
- `app.js` - Al funktionalitet (upload, API-kald, database)
- `README.md` - Denne fil

## Support

Hvis du har problemer, tjek:
- Browser-konsollen for fejlmeddelelser (F12 → Console)
- Netlify deploy logs
- Supabase logs (hvis du bruger database)
