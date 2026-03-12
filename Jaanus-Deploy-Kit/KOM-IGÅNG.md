# Kom igång med Deploy — Jaanus

Denna guide tar dig från noll till en körande app på vår Coolify-server (neptun).

## Förutsättningar

| Vad | Hur | Test |
|-----|-----|------|
| **FortiClient VPN** | IT installerar | Kan ansluta till Ö-borgen ZTNA |
| **Git** | https://git-scm.com | `git --version` |
| **Node.js 20+** | https://nodejs.org (LTS) | `node --version` |
| **Azure DevOps-åtkomst** | Johan lägger till dig i org `metstechnology` | Kan öppna dev.azure.com |

## Steg 1: Kopiera deploy-filerna till ditt projekt

Kopiera dessa filer till **roten av ditt projekt**:

```
mitt-projekt/
├── deploy.sh          ← Från detta kit
├── .deploy-env        ← Från detta kit (ifylld med tokens)
├── package.json
├── src/
└── ...
```

### deploy.sh

Kopiera `deploy.sh` och ändra **bara konfigurationen** överst:

```bash
APP_NAME="mitt-app"              # Unikt namn (inga mellanslag, små bokstäver)
APP_PORT="3000"                  # Port din app lyssnar på
DOMAIN="mitt-app.demo.neptun.oborgen.ztna"
NEEDS_DB="false"                 # "true" om du behöver PostgreSQL
BASIC_AUTH="false"               # "true" för lösenordsskydd
```

### .deploy-env

Redan ifylld med tokens — lägg den i projektets rot.

**Viktigt:** `.deploy-env` ska ALDRIG committas till git! deploy.sh skapar `.gitignore` automatiskt.

## Steg 2: Deploya

```bash
cd mitt-projekt/
bash deploy.sh
```

Scriptet gör allt automatiskt:
1. Skapar git-repo i Azure DevOps
2. Pushar din kod
3. Skapar appen i Coolify
4. Bygger och startar containern (nixpacks — auto-detekterar framework)
5. Konfigurerar HTTPS + routing
6. Skapar databas om NEEDS_DB=true
7. Kör migrationer om Prisma detekteras

**Vänta 2–5 minuter.** Appen är sedan live på `https://APP_NAME.demo.neptun.oborgen.ztna`.

## Uppdatera appen

Samma kommando varje gång:

```bash
# Gör ändringar i koden...
bash deploy.sh
```

## Vanliga portval

| Framework | Port |
|-----------|------|
| Next.js | 3000 |
| Express | 3001 |
| FastAPI | 8000 |
| Vite (preview) | 4173 |

## Med databas (PostgreSQL)

Ändra i deploy.sh:
```bash
NEEDS_DB="true"
```

Databasen skapas automatiskt vid första deploy. `DATABASE_URL` sätts som miljövariabel i containern.

Om du använder Prisma detekteras det automatiskt — migrationer körs vid varje deploy.

## Miljövariabler

Lägg till i deploy.sh:
```bash
APP_ENV_VARS="KEY1=value1 KEY2=value2"           # Runtime
APP_ENV_VARS_BUILD="NEXT_PUBLIC_API_URL=https://..."  # Byggtid
```

Variabler som redan finns i Coolify skrivs inte över — säkert att köra deploy.sh flera gånger.

## Deploy Portal

**URL:** https://deploy-portal.demo.neptun.oborgen.ztna (kräver FortiClient)

Logga in med: **jaanus.heeringsson**

Där kan du:
- Se status och loggar för alla dina appar
- Rollbacka till en tidigare version
- Starta/stoppa containrar
- Se och ändra miljövariabler

## Felsökning

| Problem | Lösning |
|---------|---------|
| `.deploy-env saknas` | Kopiera `.deploy-env` till projektets rot |
| 502 Bad Gateway | Kolla att `APP_PORT` stämmer |
| Connection refused | Starta FortiClient VPN |
| HTTPS timeout | Ny subdomän — be Johan lägga till ZTNA-destination |
| Bygger men tom sida | Kolla i Coolify-dashboard: neptun.oborgen.ztna:8000 |

## Frågor?

Kontakta Johan.
