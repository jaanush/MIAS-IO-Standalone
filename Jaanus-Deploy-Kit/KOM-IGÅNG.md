# Kom igång med Deploy — Jaanus

Denna guide tar dig från noll till en körande app på vår Coolify-server.

## Steg 0: Förutsättningar

Innan du börjar, se till att du har:

| Vad | Hur | Test |
|-----|-----|------|
| **FortiClient VPN** | IT installerar | Kan ansluta till Ö-borgen ZTNA |
| **Git** | https://git-scm.com | `git --version` |
| **Node.js 20+** | https://nodejs.org (LTS) | `node --version` |
| **Azure DevOps-åtkomst** | Johan/IT lägger till dig | Kan öppna dev.azure.com |

## Steg 1: Kopiera deploy-filerna till ditt projekt

Kopiera dessa två filer till **roten av ditt projekt**:

```
mitt-projekt/
├── deploy.sh          ← Kopiera från detta kit
├── .deploy-env        ← Kopiera och fyll i (se nedan)
├── package.json
├── src/
└── ...
```

### deploy.sh
Kopiera `deploy.sh` från detta kit. Öppna den och ändra **bara konfigurationen** överst:

```bash
APP_NAME="mitt-app"              # Byt till ditt appnamn (unikt, inga mellanslag)
APP_PORT="3000"                  # Port din app lyssnar på
NEEDS_DB="false"                 # Ändra till "true" om du behöver PostgreSQL
BASIC_AUTH="false"               # Ändra till "true" för lösenordsskydd
DEPLOY_ENV="demo"                # Miljö: demo / staging / prod
```

Domän, DNS-zon och Coolify-miljö härleds automatiskt från `DEPLOY_ENV`:

| DEPLOY_ENV | Domän | Coolify-miljö |
|------------|-------|---------------|
| demo | `mitt-app.demo.neptun.ztna` | demos |
| staging | `mitt-app.staging.neptun.ztna` | staging |
| prod | `mitt-app.prod.neptun.ztna` | production |

### .deploy-env
Johan ger dig en `.deploy-env`-fil med tokens ifyllda. Lägg den i projektets rot.

Om du skapar den själv, kopiera `deploy-env.example` → `.deploy-env` och fyll i:

```
AZURE_PAT="din-azure-pat-från-johan"
COOLIFY_TOKEN="din-coolify-token-från-johan"
```

**Viktigt:** `.deploy-env` ska ALDRIG committas till git! deploy.sh skapar `.gitignore` automatiskt.

## Steg 2: Deploya

```bash
cd mitt-projekt/
bash deploy.sh
```

Scriptet gör allt automatiskt:
1. Skapar git-repo i Azure DevOps (om det inte finns)
2. Pushar din kod
3. Skapar appen i Coolify
4. Bygger och startar containern
5. Konfigurerar HTTPS
6. Skapar databas (om NEEDS_DB=true)
7. Kör migrationer (om DB_MIGRATE_CMD är satt)

**Vänta 2–5 minuter.** Appen är sedan live!

## Steg 3: Kolla att det fungerar

- Öppna `https://mitt-app.demo.neptun.ztna` (FortiClient måste vara aktiv)
- Eller kolla i Deploy Portal: `https://portal.neptun.ztna`

## Uppdatera appen

Samma kommando varje gång:

```bash
# Gör ändringar i koden...
bash deploy.sh
```

## Deploy Portal

**URL:** `https://portal.neptun.ztna` (kräver FortiClient)

Logga in med ditt namn. Där kan du:
- Se status på dina appar
- Se loggar (container + build)
- Rollbacka till en tidigare version
- Ändra miljövariabler
- Starta/stoppa/ta bort appar

## Rollback (om något går fel)

1. Öppna Deploy Portal → din app → fliken **Deploys**
2. Klicka **Rollback** vid en tidigare lyckad deploy
3. Klart — under 1 minut

## Vanliga portval

| Framework | Port |
|-----------|------|
| Next.js | 3000 |
| Express | 3001 |
| FastAPI | 8000 |
| Vite | 4173 |

## Med databas (PostgreSQL)

Ändra i deploy.sh:
```bash
NEEDS_DB="true"
DB_MIGRATE_CMD="npx prisma migrate deploy"   # Om du använder Prisma
```

Databasen skapas automatiskt vid första deploy. `DATABASE_URL` sätts som miljövariabel.

## Multi-app (backend + frontend)

Om din app har separat backend och frontend, använd `deploy-multi.sh`:

```
min-app/
├── deploy.sh              ← Kopiera från detta kit
├── deploy-multi.sh        ← Kopiera från detta kit
├── .deploy-env            ← Tokens (samma fil som vanligt)
├── backend/               ← Backend-repo
│   ├── package.json
│   └── ...
└── frontend/              ← Frontend-repo
    ├── package.json
    └── ...
```

Öppna `deploy-multi.sh` och ändra:

```bash
BACKEND_APP_NAME="MinApp-Backend"     # Unikt namn för backend
BACKEND_PORT="3001"                    # Port backend lyssnar på
BACKEND_NEEDS_DB="true"               # Backend behöver oftast DB

FRONTEND_APP_NAME="MinApp"            # Unikt namn för frontend
FRONTEND_PORT="4173"                   # Vite preview-port
```

Kör sedan:

```bash
bash deploy-multi.sh
```

Scriptet deployer backend först, sedan frontend. Frontend får automatiskt `VITE_API_URL` som pekar på backend.

## Felsökning

| Problem | Lösning |
|---------|---------|
| "FEL: .deploy-env saknas" | Kopiera `.deploy-env` till projektets rot |
| "permission denied" | Kör: `chmod +x deploy.sh` |
| 502 Bad Gateway | Kolla att `APP_PORT` stämmer med porten appen lyssnar på |
| "Connection refused" | Starta FortiClient VPN |
| Appen bygger men sidan är tom | Kolla loggar i Deploy Portal |
| HTTPS timeout | Ny subdomän? Be Johan/IT lägga till ZTNA-destination |

## Frågor?

Kontakta Johan.
