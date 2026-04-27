# KyoriaOS Platform - Setup Guide
### Plain English. No coding experience required.

Read this entire guide before doing anything. It takes about 2-3 hours to complete.
When you're done, your booking platform will be live at app.kyoriaos.com.

---

## WHAT YOU NEED TO CREATE (6 accounts)

1. **Vercel** — hosts your website (free)
2. **Firebase** — your database and login system (free to start)
3. **Stripe** — takes payments (free, they take ~2.9% per transaction)
4. **Google Cloud** — powers the maps/distance calculation (free tier)
5. **Cloudflare R2** — stores your photos and videos (~$0.015/GB/month)
6. **Resend** — sends emails (free for first 3,000/month)

You already have: a domain (novacoastmedia.com) and a GitHub account (or we'll create one).

---

## STEP 1 — PUT THE CODE ON GITHUB

GitHub is where your code lives. Vercel reads from it to deploy your site.

1. Go to **github.com** and create a free account if you don't have one.

2. Click the **+** button in the top right → **New repository**

3. Name it: `nova-coast-platform`

4. Set it to **Private**

5. Click **Create repository**

6. Now you need to upload the code files.
   - On your Windows PC, the folder you downloaded is called `nova-coast-platform`
   - Download **GitHub Desktop** from desktop.github.com (free, no command line needed)
   - Open GitHub Desktop → **Add an Existing Repository from your Hard Drive**
   - Point it to the `nova-coast-platform` folder
   - Click **Publish repository** → make sure **Keep this code private** is checked → **Publish**

Your code is now on GitHub. ✓

---

## STEP 2 — SET UP FIREBASE

Firebase is your database. Every booking, gallery, and photographer profile lives here.

1. Go to **console.firebase.google.com**

2. Click **Add project** → Name it `nova-coast-platform` → Continue

3. Disable Google Analytics (you don't need it) → **Create project**

4. In the left sidebar, click **Build → Firestore Database**
   - Click **Create database**
   - Select **Start in production mode**
   - Pick **us-central1** as the location → **Enable**

5. In the left sidebar, click **Build → Authentication**
   - Click **Get started**
   - Click **Email/Password** → Enable it → Save

6. Create your admin account:
   - Still in Authentication, click **Add user**
   - Enter your email and a strong password
   - Click **Add user**
   - Copy the **User UID** shown — you'll need it in a minute

7. Get your Firebase config keys:
   - Click the ⚙️ gear icon → **Project settings**
   - Scroll down to **Your apps** → click the **</>** icon (Web)
   - App nickname: `nova-coast-web` → **Register app**
   - You'll see a block of code. Copy these values somewhere safe:
     ```
     apiKey: "..."
     authDomain: "..."
     projectId: "..."
     storageBucket: "..."
     messagingSenderId: "..."
     appId: "..."
     ```

8. Get your Service Account (for the backend):
   - Click ⚙️ gear → **Project settings** → **Service accounts** tab
   - Click **Generate new private key** → **Generate key**
   - A JSON file downloads. Open it in Notepad.
   - Copy ALL of its contents (the whole file)
   - Go to **jsonminify.com**, paste it in, click Minify
   - Copy the minified result — this is your `FIREBASE_SERVICE_ACCOUNT_JSON`

9. Deploy Firestore security rules:
   - We'll do this via the Firebase console directly
   - In the left sidebar → **Firestore Database** → **Rules** tab
   - Delete what's there and paste in the contents of the `firestore.rules` file
     (it's in your project folder)
   - Click **Publish**

Firebase is set up. ✓

---

## STEP 3 — SET UP STRIPE

Stripe handles all payments.

1. Go to **stripe.com** → Create an account

2. Complete business verification (they'll ask about your business — fill it out honestly)

3. In your Stripe dashboard, click **Developers** (top right)

4. Click **API keys**:
   - Copy **Publishable key** (starts with `pk_live_...`)
   - Click **Reveal** on Secret key → copy it (starts with `sk_live_...`)
   - **Important:** For testing first, use the Test mode keys (`pk_test_...` / `sk_test_...`)

5. Set up Webhooks (this is how Stripe tells your app when someone pays):
   - Click **Developers → Webhooks → Add endpoint**
   - Endpoint URL: `https://app.novacoastmedia.com/api/stripe/webhook`
   - Click **Select events** → search for and select:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - Click **Add endpoint**
   - Click on your new webhook → copy the **Signing secret** (starts with `whsec_...`)

Stripe is set up. ✓

---

## STEP 4 — SET UP GOOGLE MAPS

This powers the travel fee calculation.

1. Go to **console.cloud.google.com**

2. Create a new project → name it `nova-coast`

3. In the search bar at the top, search for **Distance Matrix API** → click it → **Enable**

4. In the left sidebar → **APIs & Services → Credentials**

5. Click **+ Create Credentials → API Key**

6. A key appears. Copy it.

7. Click **Edit API key**:
   - Under **Application restrictions**: select **IP addresses**
   - Leave blank for now (you can lock it down later)
   - Under **API restrictions**: select **Restrict key** → pick **Distance Matrix API**
   - Click **Save**

Google Maps is set up. ✓

---

## STEP 5 — SET UP CLOUDFLARE R2

R2 stores all your photos and videos for client galleries.

1. Go to **cloudflare.com** → Create a free account

2. In the left sidebar → **R2**

3. Click **Create bucket**:
   - Bucket name: `nova-coast-media`
   - Location: **Automatic**
   - Click **Create bucket**

4. Click on your new bucket → **Settings** tab:
   - Scroll to **Public access** → **Allow Access** → confirm
   - Copy the **Public bucket URL** shown (looks like `https://pub-xxx.r2.dev`)
   - This is your `NEXT_PUBLIC_R2_PUBLIC_URL`

5. Create API keys:
   - Go back to R2 main page → **Manage R2 API tokens**
   - Click **Create API token**
   - Permissions: **Object Read & Write**
   - Specify bucket: `nova-coast-media`
   - Click **Create API Token**
   - Copy **Access Key ID** and **Secret Access Key**

6. Find your Account ID:
   - In the Cloudflare dashboard, look at the URL — it contains your account ID
   - Or click **Workers & Pages** in the sidebar — your Account ID is shown on the right
   - Your R2 endpoint will be: `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com`

Cloudflare R2 is set up. ✓

---

## STEP 6 — SET UP RESEND (EMAIL)

1. Go to **resend.com** → Sign up

2. Click **API Keys** in the sidebar → **Create API Key**
   - Name: `nova-coast`
   - Copy the key (starts with `re_...`)

3. Click **Domains** → **Add Domain**
   - Enter: `novacoastmedia.com`
   - They'll give you DNS records to add
   - Log into wherever your domain is managed (GoDaddy, Namecheap, etc.)
   - Add the DNS records they give you (copy/paste)
   - Click **Verify** in Resend — may take a few minutes

Resend is set up. ✓

---

## STEP 7 — BUILD YOUR .ENV.LOCAL FILE

This file holds all your secret keys. It never gets uploaded to GitHub.

1. In your `nova-coast-platform` folder, find the file called `.env.local.example`

2. Right-click → **Rename** → remove `.example` so it becomes `.env.local`

3. Open it with Notepad

4. Fill in every value using what you collected above:

```
NEXT_PUBLIC_FIREBASE_API_KEY=          ← from Step 2, Firebase config
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=      ← from Step 2, Firebase config
NEXT_PUBLIC_FIREBASE_PROJECT_ID=       ← from Step 2, Firebase config
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=   ← from Step 2, Firebase config
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID= ← from Step 2, Firebase config
NEXT_PUBLIC_FIREBASE_APP_ID=           ← from Step 2, Firebase config

FIREBASE_SERVICE_ACCOUNT_JSON=         ← the minified JSON from Step 2

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=    ← from Step 3
STRIPE_SECRET_KEY=                     ← from Step 3
STRIPE_WEBHOOK_SECRET=                 ← from Step 3

GOOGLE_MAPS_API_KEY=                   ← from Step 4

R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY=                         ← from Step 5
R2_SECRET_KEY=                         ← from Step 5
R2_BUCKET=nova-coast-media
NEXT_PUBLIC_R2_PUBLIC_URL=             ← the public bucket URL from Step 5

RESEND_API_KEY=                        ← from Step 6

NEXT_PUBLIC_APP_URL=https://app.novacoastmedia.com
NEXT_PUBLIC_FROM_ZIP=92108
```

5. Save the file.

---

## STEP 8 — DEPLOY TO VERCEL

1. Go to **vercel.com** → Sign up with your GitHub account

2. Click **Add New → Project**

3. Find `nova-coast-platform` in the list → click **Import**

4. Under **Environment Variables**, add every key from your `.env.local` file:
   - Click **Add** for each one
   - Name = the left side (e.g. `NEXT_PUBLIC_FIREBASE_API_KEY`)
   - Value = the right side (your actual key)
   - **Do not add the `=` sign — just paste the value**

5. Click **Deploy**

6. Wait 2–3 minutes. Vercel builds and deploys automatically.

7. When it finishes, you'll see a URL like `nova-coast-platform.vercel.app`
   — your site is live, but on a temporary URL. Next we'll connect your domain.

---

## STEP 9 — CONNECT YOUR DOMAIN

1. In Vercel, click your project → **Settings → Domains**

2. Type: `app.novacoastmedia.com` → **Add**

3. Vercel will show you DNS records to add. They'll look like:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```

4. Log into wherever your domain lives (GoDaddy, Namecheap, Google Domains, etc.)

5. Find **DNS Management** → add the records Vercel gave you

6. Back in Vercel, click **Verify** — may take up to 10 minutes

7. Your site is now live at `https://app.novacoastmedia.com` ✓

---

## STEP 10 — MAKE YOURSELF AN ADMIN

1. In your `nova-coast-platform` folder, open a terminal:
   - On Windows: hold **Shift**, right-click inside the folder → **Open PowerShell window here**

2. First install dependencies (you only do this once):
   ```
   npm install
   ```

3. Run the admin script:
   ```
   node scripts/set-admin.js your@email.com
   ```
   (Use the email you created in Firebase Step 2)

4. You should see: `✓ Admin claim set for your@email.com`

5. Go to `https://app.novacoastmedia.com/admin/login`

6. Log in with your Firebase email and password

7. You're in. ✓

---

## STEP 11 — UPDATE STRIPE WEBHOOK URL

Now that your real URL is live:

1. Go back to Stripe → **Developers → Webhooks**

2. Click your webhook → **Update details**

3. Change the URL to: `https://app.novacoastmedia.com/api/stripe/webhook`

4. Save

---

## YOU'RE LIVE ✓

Your platform is now running at `https://app.novacoastmedia.com`

| Page | URL |
|---|---|
| Booking flow | app.novacoastmedia.com/book |
| Admin dashboard | app.novacoastmedia.com/admin |
| Client gallery | app.novacoastmedia.com/gallery/[token] |

---

## AFTER LAUNCH — FIRST THINGS TO DO

1. **Test a booking end-to-end** using Stripe's test card `4242 4242 4242 4242`

2. **Add yourself as a photographer** in the admin → Photographers page

3. **Link your booking page** from your main website:
   - Add a "Book a Shoot" button on novacoastmedia.com that links to
     `https://app.novacoastmedia.com/book`

4. **Switch Stripe to live mode** when you're ready to take real payments
   - Go back to Stripe, flip the toggle from Test → Live
   - Update your Vercel env vars with the live keys (not test keys)
   - Redeploy from Vercel dashboard → **Deployments → Redeploy**

---

## WHAT TO DO WHEN YOU GET STUCK

- Vercel deployment errors → look at the **Build logs** in Vercel dashboard
- Payments not going through → check Stripe's **Events** log in the Dashboard
- Emails not sending → check Resend's dashboard → **Logs**
- Anything else → screenshot the error and bring it here

---

## WHAT'S COMING IN PHASE 2

Phase 2 adds the full custom scheduling system:
- Live calendar availability per photographer
- Google Calendar sync (block their busy times automatically)
- Smart time slot generation based on shoot duration
- Client picks exact time instead of just "preferred date"

Everything built in Phase 1 is already wired to support it — it just plugs in on top.
