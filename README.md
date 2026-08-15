# Not Al

Mobilde gezerken karsilastgin icerikleri tek dokunusla kaydedip, ozet, ceviri ve akilli kategorilerle sana geri sunan kisisel bilgi toplama uygulamasi.

## Teknoloji

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes, Prisma 7 (PostgreSQL), BullMQ (Redis)
- **Worker:** Node.js + tsx, BullMQ consumer
- **Auth:** iron-session (admin password + user magic code)
- **AI:** OpenAI API (ozet, ceviri, kategorileme)
- **Storage:** Lokal disk (`/data/notal-storage`)
- **Deploy:** Docker + Coolify

## Hizli Baslangic (Docker)

```bash
# 1. Repo'yu klonla
git clone <repo-url> not-al && cd not-al

# 2. .env dosyasini olustur
cp .env.example .env
# .env icindeki degerleri guncelle:
#   DB_PASSWORD, SESSION_SECRET, ENCRYPTION_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
# Rastgele sir uretmek icin: openssl rand -base64 48

# 3. Docker Compose ile calistir
docker compose up -d

# 4. Veritabanini olustur ve seed et
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

`SESSION_SECRET` zorunludur ve tanimli degilse uygulama acik hata verir.
`ENCRYPTION_KEY` tanimlanmazsa `SESSION_SECRET`'ten turetilir; bu durumda
`SESSION_SECRET` degistirildiginde kayitli OpenAI/DeepL/SMTP sirlari cozulemez.

Uygulama `http://localhost:3000` adresinde calisir.

## Lokal Gelistirme

```bash
# Bagimliliklari kur
npm install

# .env dosyasini olustur
cp .env.example .env

# PostgreSQL ve Redis'in calistigından emin ol
# Prisma client olustur ve migration'lari uygula
npx prisma generate
npm run db:migrate

# Seed calistir
npm run db:seed

# Dev server baslat
npm run dev

# Worker'i ayri terminalde baslat
npm run worker
```

## Scriptler

| Script | Aciklama |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Prisma generate + Next.js build |
| `npm run start` | Production server |
| `npm run worker` | BullMQ worker |
| `npm run db:push` | Prisma schema'yi DB'ye push et |
| `npm run db:migrate` | Prisma migration deploy |
| `npm run db:seed` | Admin kullanici ve system settings seed |
| `npm run db:studio` | Prisma Studio (DB browser) |

## Coolify Deployment

1. GitHub repo'sunu Coolify'a bagla
2. **Build Pack:** Docker Compose
3. **Environment Variables** ekle:
   - `DB_PASSWORD` - PostgreSQL sifresi (compose bunu hem postgres'e hem
     `DATABASE_URL`'e verir; repoda hicbir sifre yazili degildir)
   - `SESSION_SECRET` - En az 32 karakter rastgele string (zorunlu)
   - `ENCRYPTION_KEY` - Kayitli API anahtarlarini sifreler (onerilir)
   - `ADMIN_EMAIL` - Admin email
   - `ADMIN_PASSWORD` - Admin sifresi
4. Domain: `notes.kronomondo.org`
5. Deploy sonrasi:
   ```bash
   docker compose exec app npm run db:migrate
   docker compose exec app npm run db:seed
   ```

## Veritabani Migration'lari

Proje artik `prisma db push` yerine versiyonlanmis migration kullanir.

**Zaten `db push` ile olusturulmus bir veritabaniniz varsa** (mevcut production),
ilk migration'i calistirilmis olarak isaretleyin, yoksa Prisma bastan tablo
yaratmaya calisir:

```bash
docker compose exec app npx prisma migrate resolve --applied 20260326000000_init
docker compose exec app npm run db:migrate
```

Bos bir veritabaninda dogrudan `npm run db:migrate` yeterlidir.

Sema degistirdiginizde yeni migration uretmek icin:

```bash
npx prisma migrate dev --name aciklayici_isim
```

## Proje Yapisi

```
not-al/
  prisma/
    schema.prisma          # Veritabani modelleri
    migrations/            # Versiyonlanmis SQL migration'lari
    seed.ts                # Admin ve system settings seed
  src/
    app/
      (auth)/login/        # Giris sayfasi
      admin/               # Admin paneli (dashboard, email, settings, users)
      dashboard/           # Kullanici paneli (inbox, notes, favorites, archive, settings, shortcut, api-keys)
      share/[token]/       # Public paylasim sayfasi
      api/                 # API routes (auth, notes, admin, settings, ingest, api-keys)
    components/
      ui/                  # Button, Input, Badge, Card, Textarea
      layout/              # Sidebar
      notes/               # NoteCard, NoteDetail, AddNoteModal, NotesHeader
    generated/prisma/      # Prisma generated client
    lib/                   # prisma, session, crypto, tokens, safe-fetch, openai, queue, ...
    worker/                # BullMQ worker + note processor
    proxy.ts               # Oturum kontrolu (Next.js 16'da middleware'in yeni adi)
  docker-compose.yml
  Dockerfile               # Next.js app
  Dockerfile.worker         # BullMQ worker
```

## Ozellikler

- **Link/Metin notu kaydetme** - URL veya serbest metin
- **Otomatik icerik cikarma** - Readability ile makale parse
- **AI ozet** - OpenAI ile otomatik ozetleme
- **AI ceviri** - Icerik cevirisi
- **AI kategorileme** - Otomatik etiket ve kategori
- **iPhone kisayolu** - Paylasim menusunden direkt gonderim
- **API anahtarlari** - Programatik erisim
- **Not paylasimi** - Public link ile paylasim
- **Admin paneli** - SMTP, sistem ayarlari, kullanici yonetimi
