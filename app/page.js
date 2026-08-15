import Link from "next/link";
import DiscountPopup from "@/components/DiscountPopup";
import LandingMobileNav from "@/components/LandingMobileNav";
import { PLANS } from "@/lib/plans";

export const metadata = {
  title: "Kyoria OS: The Complete System for Real Estate Media Businesses",
  description:
    "Booking, scheduling, gallery delivery, and client portals, all connected. Kyoria OS replaces the tools real estate photographers patch together.",
  alternates: { canonical: "https://kyoriaos.com/" },
};

// Refined "light luxury" landing system: DM Sans body, Playfair Display
// headings, Cormorant Garamond italic accents, a single navy + gold palette,
// gold hairlines, and generous whitespace. Scoped entirely under .lp.
const CSS = `
:root{
  --navy:#132542; --navy-2:#1b3157; --ink:#1a2030;
  --gold:#c9a96e; --gold-dark:#a8843f; --gold-soft:#f6eeda;
  --bg:#ffffff; --cream:#faf7f1; --cream-2:#f3ede1;
  --muted:#5a616e; --muted-2:#949aa5; --line:#e9e2d4;
  --serif:'Playfair Display', Georgia, serif;
  --ital:'Cormorant Garamond', Georgia, serif;
  --sans:'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --r:16px;
  --shadow:0 1px 2px rgba(19,37,66,0.04),0 10px 30px -12px rgba(19,37,66,0.10);
  --shadow-lg:0 30px 70px -24px rgba(19,37,66,0.22);
}
.lp *{box-sizing:border-box;margin:0;}
.lp{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;scroll-behavior:smooth;}
.lp a{text-decoration:none;color:inherit;}
.lp .wrap{max-width:1180px;margin:0 auto;padding:0 32px;}
.lp h1,.lp h2,.lp h3,.lp h4{font-family:var(--serif);font-weight:700;letter-spacing:-0.01em;color:var(--navy);}
.lp em{font-family:var(--ital);font-style:italic;font-weight:600;color:var(--gold-dark);letter-spacing:0;}

/* Eyebrow: uppercase tracked label with a gold hairline */
.lp .eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:var(--sans);font-size:11.5px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:var(--gold-dark);margin-bottom:22px;}
.lp .eyebrow::before{content:'';width:28px;height:1px;background:var(--gold);}
.lp .eyebrow.center{justify-content:center;}

/* Buttons */
.lp .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:52px;padding:0 32px;border-radius:4px;font-family:var(--sans);font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;border:1px solid transparent;transition:transform .18s ease,background .2s ease,color .2s ease,box-shadow .25s ease;}
.lp .btn-ink{background:var(--navy);color:#fff;}
.lp .btn-ink:hover{background:var(--navy-2);transform:translateY(-2px);box-shadow:var(--shadow);}
.lp .btn-ghost{border-color:var(--line);background:#fff;color:var(--navy);}
.lp .btn-ghost:hover{border-color:var(--navy);transform:translateY(-2px);}
.lp .btn-gold{background:var(--gold);color:#2a2008;}
.lp .btn-gold:hover{background:#d8bd85;transform:translateY(-2px);box-shadow:0 12px 30px -10px rgba(201,169,110,0.6);}
.lp .btn-sm{height:44px;padding:0 22px;font-size:11px;}

/* NAV */
.lp .nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.86);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);}
.lp .nav .row{display:flex;align-items:center;justify-content:space-between;height:76px;}
.lp .logo{display:flex;align-items:center;flex-shrink:0;}
.lp .logo-img{height:42px;width:auto;object-fit:contain;display:block;}
.lp .nav nav{display:flex;gap:34px;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);}
.lp .nav nav a{transition:color .2s;}
.lp .nav nav a:hover{color:var(--gold-dark);}
.lp .nav .cta{display:flex;align-items:center;gap:20px;}
.lp .nav .signin{font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
.lp .nav .signin:hover{color:var(--navy);}

/* HERO */
.lp .hero{padding:96px 0 0;background:linear-gradient(180deg,var(--cream) 0%,var(--bg) 78%);overflow:hidden;}
.lp .hero .inner{text-align:center;max-width:820px;margin:0 auto;}
.lp .hero h1{font-size:clamp(40px,5.6vw,64px);line-height:1.07;}
.lp .hero .lede{font-size:19px;color:var(--muted);max-width:620px;margin:26px auto 0;line-height:1.65;}
.lp .hero .ctas{display:flex;gap:14px;justify-content:center;margin-top:38px;}
.lp .hero .micro{margin-top:20px;font-size:13px;letter-spacing:0.04em;color:var(--muted-2);}

.lp .chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:40px;max-width:760px;margin-left:auto;margin-right:auto;}
.lp .chip{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--navy);background:#fff;border:1px solid var(--line);border-radius:99px;padding:9px 18px;box-shadow:0 1px 2px rgba(19,37,66,0.04);}
.lp .chip i{font-style:normal;color:var(--gold-dark);font-weight:700;}

.lp .hero-shot{max-width:1040px;margin:64px auto -2px;background:#fff;border:1px solid var(--line);border-bottom:none;border-radius:20px 20px 0 0;box-shadow:var(--shadow-lg);overflow:hidden;}
.lp .hero-shot .bar{display:flex;align-items:center;gap:7px;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--cream);}
.lp .hero-shot .bar i{width:10px;height:10px;border-radius:50%;font-style:normal;background:var(--line);}
.lp .hero-shot .bar .url{flex:1;max-width:360px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:8px;font-size:11.5px;letter-spacing:0.04em;color:var(--muted-2);text-align:center;padding:5px 12px;}
.lp .hero-shot .img{aspect-ratio:16/7.6;background:linear-gradient(135deg,#f3f1ec,#eae7df);overflow:hidden;}
.lp .hero-shot .img img,.lp .shot .img img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}

/* SECTIONS */
.lp section.block{padding:clamp(80px,10vw,120px) 0;}
.lp .sec-head{text-align:center;max-width:720px;margin:0 auto 64px;}
.lp .sec-head h2{font-size:clamp(30px,4vw,44px);line-height:1.14;}
.lp .sec-head p{color:var(--muted);font-size:17px;line-height:1.7;margin-top:18px;}
.lp .rule{width:100%;max-width:920px;height:1px;margin:0 auto;background:linear-gradient(to right,transparent,var(--line) 20%,var(--line) 80%,transparent);}

/* BEFORE/AFTER */
.lp .ba{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1000px;margin:0 auto;}
.lp .ba .col{border-radius:var(--r);padding:40px 38px;}
.lp .ba .before{background:var(--cream);border:1px solid var(--line);}
.lp .ba .after{background:var(--navy);color:#fff;position:relative;overflow:hidden;}
.lp .ba .after::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(to right,transparent,var(--gold),transparent);}
.lp .ba .tag{display:inline-flex;align-items:center;gap:8px;font-family:var(--sans);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:24px;}
.lp .ba .before .tag{color:var(--muted-2);}
.lp .ba .after .tag{color:var(--gold);}
.lp .ba li{list-style:none;display:flex;gap:13px;padding:11px 0;font-size:15px;line-height:1.5;border-top:1px solid;}
.lp .ba .before li{color:var(--muted);border-color:rgba(19,37,66,0.06);}
.lp .ba .before li:first-of-type{border-top:none;}
.lp .ba .before li i{font-style:normal;color:var(--muted-2);flex-shrink:0;font-weight:700;}
.lp .ba .after li{color:rgba(255,255,255,0.84);border-color:rgba(255,255,255,0.08);}
.lp .ba .after li:first-of-type{border-top:none;}
.lp .ba .after li i{font-style:normal;color:var(--gold);flex-shrink:0;font-weight:700;}

/* HOW IT WORKS */
.lp .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.lp .step{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:32px 28px;transition:transform .2s ease,box-shadow .2s ease;box-shadow:var(--shadow);}
.lp .step:hover{transform:translateY(-5px);box-shadow:var(--shadow-lg);}
.lp .step .num{font-family:var(--serif);font-size:34px;font-weight:700;color:var(--gold);line-height:1;}
.lp .step h3{font-size:20px;margin:18px 0 10px;}
.lp .step p{font-size:14px;color:var(--muted);line-height:1.65;}

/* BENEFITS — unified white cards, gold accents only */
.lp .bens{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.lp .ben{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:34px 28px;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;}
.lp .ben:hover{transform:translateY(-5px);box-shadow:var(--shadow-lg);border-color:rgba(201,169,110,0.5);}
.lp .ben .ic{width:48px;height:48px;border-radius:12px;background:var(--gold-soft);color:var(--gold-dark);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:22px;}
.lp .ben h3{font-size:19px;margin-bottom:10px;}
.lp .ben p{font-size:14px;color:var(--muted);line-height:1.65;}

/* SCREENSHOTS */
.lp .shots{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;}
.lp .shot{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:#fff;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease;}
.lp .shot:hover{transform:translateY(-5px);box-shadow:var(--shadow-lg);}
.lp .shot .img{aspect-ratio:16/9;background:linear-gradient(135deg,#f3f1ec,#e9e6de);overflow:hidden;}
.lp .shot .cap{padding:24px 28px;}
.lp .shot .cap h3{font-size:19px;}
.lp .shot .cap p{font-size:14px;color:var(--muted);margin-top:6px;line-height:1.65;}

/* AGENT KIT */
.lp .kit{background:var(--cream);border:1px solid var(--line);border-radius:24px;padding:clamp(48px,6vw,80px);display:grid;grid-template-columns:1.05fr 1fr;gap:64px;align-items:center;}
.lp .kit h2{font-size:clamp(28px,3.4vw,38px);line-height:1.16;}
.lp .kit .lede{color:var(--muted);font-size:16px;line-height:1.75;margin:18px 0 26px;}
.lp .kit .feats{display:flex;flex-direction:column;gap:14px;}
.lp .kit .feat{display:flex;gap:13px;font-size:15px;color:var(--ink);}
.lp .kit .feat i{font-style:normal;color:var(--gold-dark);font-weight:700;flex-shrink:0;}
.lp .kcard{background:#fff;border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow-lg);border:1px solid var(--line);}
.lp .kcard .ph{aspect-ratio:16/8;background:linear-gradient(135deg,var(--navy),var(--navy-2));display:flex;align-items:flex-end;padding:22px;}
.lp .kcard .ph b{font-family:var(--serif);color:#fff;font-size:20px;font-weight:700;display:block;}
.lp .kcard .ph s{text-decoration:none;font-size:12px;letter-spacing:0.04em;color:rgba(255,255,255,0.6);}
.lp .kcard .body{padding:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.lp .kcard .cell{background:var(--cream);border:1px solid var(--line);border-radius:12px;padding:14px;text-align:center;}
.lp .kcard .cell b{display:block;font-family:var(--serif);font-size:16px;color:var(--navy);}
.lp .kcard .cell s{text-decoration:none;font-size:10.5px;letter-spacing:0.03em;color:var(--muted-2);}

/* TESTIMONIALS */
.lp .quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.lp .quote{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:34px 30px;display:flex;flex-direction:column;box-shadow:var(--shadow);}
.lp .quote .stars{color:var(--gold);font-size:13px;letter-spacing:3px;margin-bottom:18px;}
.lp .quote p{font-family:var(--ital);font-style:italic;font-size:19px;color:var(--navy);line-height:1.55;flex:1;}
.lp .quote .who{margin-top:24px;padding-top:20px;border-top:1px solid var(--line);display:flex;align-items:center;gap:12px;}
.lp .quote .who .av{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;}
.lp .quote .who b{display:block;font-family:var(--sans);font-size:14px;color:var(--ink);}
.lp .quote .who s{text-decoration:none;font-size:12px;color:var(--muted-2);}

/* PRICING */
.lp .price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:940px;margin:0 auto;align-items:stretch;}
.lp .plan{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:38px 30px;display:flex;flex-direction:column;position:relative;box-shadow:var(--shadow);}
.lp .plan.featured{border:1.5px solid var(--gold);box-shadow:var(--shadow-lg);}
.lp .plan .ribbon{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--navy);color:var(--gold);font-family:var(--sans);font-size:10.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;padding:6px 18px;border-radius:99px;}
.lp .plan .pn{font-family:var(--sans);font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold-dark);}
.lp .plan .pp{font-family:var(--serif);font-size:48px;font-weight:700;color:var(--navy);margin:14px 0 6px;}
.lp .plan .pp span{font-family:var(--sans);font-size:14px;font-weight:500;color:var(--muted-2);letter-spacing:0;}
.lp .plan .pd{font-size:13.5px;color:var(--muted);min-height:40px;}
.lp .plan ul{list-style:none;padding:0;margin:24px 0 28px;flex:1;display:flex;flex-direction:column;gap:12px;}
.lp .plan li{font-size:14px;display:flex;gap:10px;color:#454b57;}
.lp .plan .ck{color:var(--gold-dark);font-weight:700;}
.lp .scale-bar{max-width:940px;margin:16px auto 0;background:var(--navy);color:#fff;border-radius:var(--r);padding:28px 34px;display:flex;align-items:center;gap:32px;position:relative;overflow:hidden;}
.lp .scale-bar::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(to right,transparent,var(--gold),transparent);}
.lp .scale-bar .left{flex:1;}
.lp .scale-bar .nm{font-family:var(--serif);font-size:20px;font-weight:700;color:#fff;}
.lp .scale-bar .ds{font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;}
.lp .scale-bar .spec{text-align:center;}
.lp .scale-bar .spec b{display:block;font-family:var(--serif);font-size:22px;font-weight:700;color:var(--gold);}
.lp .scale-bar .spec s{text-decoration:none;font-size:11px;letter-spacing:0.03em;color:rgba(255,255,255,0.55);}
.lp .scale-bar .vd{width:1px;height:38px;background:rgba(255,255,255,0.14);}

/* FINAL CTA */
.lp .final{padding:20px 0 clamp(80px,10vw,120px);}
.lp .final .card{background:var(--navy);border-radius:28px;text-align:center;padding:clamp(64px,8vw,100px) 40px;color:#fff;position:relative;overflow:hidden;}
.lp .final .card::before{content:'';position:absolute;inset:0;background:radial-gradient(680px 340px at 50% -12%,rgba(201,169,110,0.26),transparent 66%);}
.lp .final .eyebrow{color:var(--gold);}
.lp .final .eyebrow::before{background:var(--gold);}
.lp .final h2{font-size:clamp(32px,4.4vw,48px);line-height:1.12;max-width:660px;margin:0 auto 18px;position:relative;color:#fff;}
.lp .final h2 em{color:var(--gold);}
.lp .final p{color:rgba(255,255,255,0.62);max-width:480px;margin:0 auto 34px;font-size:16px;line-height:1.65;position:relative;}
.lp .final .micro{font-size:13px;letter-spacing:0.04em;color:rgba(255,255,255,0.4);margin-top:20px;}
.lp .final .btn{position:relative;}

/* FOOTER */
.lp .footer{border-top:1px solid var(--line);padding:64px 0 40px;font-size:13.5px;color:var(--muted);}
.lp .footer .cols{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:44px;padding-bottom:44px;border-bottom:1px solid var(--line);}
.lp .footer h4{font-family:var(--sans);color:var(--navy);font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:16px;}
.lp .footer a{display:block;padding:5px 0;color:var(--muted);transition:color .18s;}
.lp .footer a:hover{color:var(--gold-dark);}
.lp .footer .base{display:flex;justify-content:space-between;padding-top:24px;font-size:12.5px;letter-spacing:0.03em;color:var(--muted-2);}

/* Mobile hamburger nav (LandingMobileNav) */
.lp .lp-mnav{display:none;position:relative;}
.lp .lp-mnav-btn{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:none;background:transparent;color:var(--navy);cursor:pointer;border-radius:10px;}
.lp .lp-mnav-btn:active{background:rgba(0,0,0,0.05);}
.lp .lp-mnav-backdrop{position:fixed;inset:0;top:76px;background:rgba(19,37,66,0.35);z-index:60;}
.lp .lp-mnav-panel{position:fixed;top:76px;left:0;right:0;z-index:61;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 16px 40px rgba(0,0,0,0.12);display:flex;flex-direction:column;padding:10px 20px 20px;}
.lp .lp-mnav-panel a{display:block;padding:14px 4px;font-size:14px;font-weight:600;letter-spacing:0.06em;color:var(--navy);border-bottom:1px solid rgba(0,0,0,0.04);}
.lp .lp-mnav-panel a:last-child{border-bottom:none;}
.lp .lp-mnav-sep{height:8px;}
.lp .lp-mnav-panel .lp-mnav-cta{margin-top:10px;background:var(--navy);color:#fff;text-align:center;border-radius:6px;padding:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;font-size:12px;border-bottom:none;}

@media(max-width:980px){
  .lp .ba,.lp .shots,.lp .kit{grid-template-columns:1fr;}
  .lp .steps,.lp .bens{grid-template-columns:1fr 1fr;}
  .lp .quotes,.lp .price-grid{grid-template-columns:1fr;}
  .lp .scale-bar{flex-direction:column;align-items:flex-start;gap:20px;}
  .lp .footer .cols{grid-template-columns:1fr 1fr;}
}

/* Tablet/large-phone: collapse the desktop nav into the hamburger */
@media(max-width:840px){
  .lp .nav nav{display:none;}
  .lp .nav .cta .signin{display:none;}
  .lp .lp-mnav{display:block;}
}

/* Phones */
@media(max-width:640px){
  .lp .wrap{padding-left:20px;padding-right:20px;}
  .lp .hero{padding-top:56px;}
  .lp .hero .lede{font-size:16.5px;}
  .lp .ctas{flex-direction:column;align-items:stretch;}
  .lp .ctas .btn{width:100%;}
  .lp .chip{font-size:12px;padding:7px 13px;}
  .lp .steps,.lp .bens{grid-template-columns:1fr;}
  .lp .ba .col{padding:32px 26px;}
  .lp .footer .cols{grid-template-columns:1fr;}
  .lp .footer .base{flex-direction:column;gap:8px;}
}
`;

// Real prices/limits — sourced from lib/plans.js so the marketing page can never
// drift from billing. (The design mockup used placeholder numbers.)
const seat = (n) => `${n} seat${n === 1 ? "" : "s"}`;
const PRICE_PLANS = [
  {
    id: "solo",
    name: "Solo",
    desc: "For solo owner-operators getting organized.",
    featured: false,
    btn: "btn-ghost",
    features: [
      `${PLANS.solo.activeListings} listing credits / year`,
      seat(PLANS.solo.teamSeats),
      "Booking, scheduling & delivery",
      "Automatic payments",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    desc: "For growing teams with higher volume.",
    featured: true,
    btn: "btn-ink",
    features: [
      `${PLANS.studio.activeListings} listing credits / year`,
      seat(PLANS.studio.teamSeats),
      "SMS notifications",
      "Everything in Solo",
    ],
  },
  {
    id: "pro",
    name: "Pro Team",
    desc: "For multi-photographer operations.",
    featured: false,
    btn: "btn-ghost",
    features: [
      `${PLANS.pro.activeListings} listing credits / year`,
      seat(PLANS.pro.teamSeats),
      "Service-area routing",
      "Everything in Studio",
    ],
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KyoriaOS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://kyoriaos.com",
  description: "The complete system for real estate media businesses: booking, scheduling, gallery delivery, payments, property websites, and an agent portal — all connected.",
  offers: {
    "@type": "Offer",
    price: String(PLANS.solo.monthlyPrice),
    priceCurrency: "USD",
  },
  publisher: { "@type": "Organization", name: "KyoriaOS", url: "https://kyoriaos.com", logo: "https://kyoriaos.com/kyoriaos-logo.png" },
};

export default function MarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Cormorant+Garamond:ital,wght@1,500;1,600&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <DiscountPopup />

      <div className="lp">
        {/* NAV */}
        <header className="nav">
          <div className="wrap row">
            <Link className="logo" href="/">
              <img src="/kyoriaos-logo.png" alt="Kyoria OS" className="logo-img" />
            </Link>
            <nav>
              <a href="#how-it-works">How it works</a>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/blog">Blog</Link>
            </nav>
            <div className="cta">
              <Link className="signin" href="/demo">View demo</Link>
              <Link className="signin" href="/auth/login">Sign in</Link>
              <Link className="btn btn-ink btn-sm" href="/auth/register">Get Started</Link>
            </div>
            <LandingMobileNav />
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <div className="wrap">
            <div className="inner">
              <span className="eyebrow center">The complete system for real estate media</span>
              <h1>Run your entire photography business from <em>one</em> quiet, connected system.</h1>
              <p className="lede">Booking, scheduling, gallery delivery, contracts, and payments, all in one place, so you can stop patching tools together and start running a real business.</p>
              <div className="ctas">
                <Link className="btn btn-ink" href="/auth/register">Get Started</Link>
                <Link className="btn btn-ghost" href="/demo">Explore the live demo</Link>
              </div>
              <p className="micro">Replaces your booking tools, delivery platforms, and client back-and-forth.</p>
              <div className="chips">
                <span className="chip"><i>✓</i>Collect deposits automatically</span>
                <span className="chip"><i>✓</i>Sign contracts at checkout</span>
                <span className="chip"><i>✓</i>Deliver galleries instantly</span>
                <span className="chip"><i>✓</i>Get paid before downloads</span>
                <span className="chip"><i>✓</i>Give agents a full portal</span>
              </div>
            </div>

            <div className="hero-shot">
              <div className="bar">
                <i></i><i></i><i></i>
                <span className="url">app.kyoriaos.com/dashboard</span>
              </div>
              <div className="img"><img src="/screenshots/Dashboard.png" alt="Kyoria OS dashboard" /></div>
            </div>
          </div>
        </section>

        {/* PROBLEM / BEFORE-AFTER */}
        <section className="block" style={{ background: "var(--cream)" }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow center">The problem</span>
              <h2>You&apos;re running a media business out of <em>duct tape</em> and iMessage.</h2>
              <p>Every tool disconnected. Every follow-up manual. There&apos;s a calmer way to work.</p>
            </div>
            <div className="ba">
              <div className="col before">
                <span className="tag">The old way</span>
                <li><i>✕</i>Chase deposits over iMessage</li>
                <li><i>✕</i>Send Dropbox links manually after delivery</li>
                <li><i>✕</i>Follow up on unpaid balances for weeks</li>
                <li><i>✕</i>Coordinate photographers in group texts</li>
                <li><i>✕</i>Clients lose the gallery link and text you</li>
                <li><i>✕</i>No record of what each shoot actually made</li>
                <li><i>✕</i>Chase paperwork and signatures by email</li>
              </div>
              <div className="col after">
                <span className="tag">With Kyoria OS</span>
                <li><i>✓</i>Deposit collected the moment they book</li>
                <li><i>✓</i>Gallery delivered in one click, locked until paid</li>
                <li><i>✓</i>Balance auto-collected before downloads unlock</li>
                <li><i>✓</i>Assign photographers from the dashboard</li>
                <li><i>✓</i>Gallery link re-sent on demand</li>
                <li><i>✓</i>Full revenue breakdown per listing</li>
                <li><i>✓</i>Service agreement signed at checkout</li>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="block" id="how-it-works">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow center">How it works</span>
              <h2>Four steps. <em>Every</em> job, handled.</h2>
              <p>From first contact to final payment, the entire job cycle runs through one system.</p>
            </div>
            <div className="steps">
              <div className="step"><div className="num">01</div><h3>They book</h3><p>Clients pick a package on your branded booking page, sign your agreement, and pay the deposit, all in one flow.</p></div>
              <div className="step"><div className="num">02</div><h3>You shoot</h3><p>Assign photographers from the dashboard. Schedules and reminders go out automatically.</p></div>
              <div className="step"><div className="num">03</div><h3>You deliver</h3><p>Upload once. Gallery, property website, and brochure are generated and sent in one click.</p></div>
              <div className="step"><div className="num">04</div><h3>You get paid</h3><p>Balance auto-collected before downloads unlock. No chasing, no awkward emails.</p></div>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="block" id="features" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="rule" style={{ marginBottom: "clamp(64px,8vw,96px)" }}></div>
            <div className="sec-head">
              <span className="eyebrow center">Why Kyoria OS</span>
              <h2>Built to <em>grow</em> your business, not just manage it.</h2>
            </div>
            <div className="bens">
              <div className="ben"><div className="ic">◆</div><h3>Branded everything</h3><p>Booking page, galleries, property sites, and emails carry your logo and colors. Clients see your brand, not ours.</p></div>
              <div className="ben"><div className="ic">▣</div><h3>Payments on autopilot</h3><p>Deposits at booking, balances at delivery, reminders in between. Stripe-powered, hands-off.</p></div>
              <div className="ben"><div className="ic">⬡</div><h3>Service-area routing</h3><p>Draw your zones on a map. Bookings inside a zone go to the photographers you&apos;ve assigned to it.</p></div>
              <div className="ben"><div className="ic">◎</div><h3>Agent self-serve portal</h3><p>Agents log in to view galleries, download media, request revisions, and rebook. You stay out of the inbox.</p></div>
            </div>
          </div>
        </section>

        {/* SCREENSHOTS */}
        <section className="block" style={{ background: "var(--cream)" }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow center">The platform</span>
              <h2>Every part of your business, in <em>one</em> dashboard.</h2>
              <p>Not renders. Not mockups. The actual platform, running live businesses today.</p>
            </div>
            <div className="shots">
              <div className="shot"><div className="img"><img src="/screenshots/Dashboard.png" alt="Dashboard" /></div><div className="cap"><h3>The morning command center</h3><p>Today&apos;s shoots, team on duty, and anything that needs you, in one glance.</p></div></div>
              <div className="shot"><div className="img"><img src="/screenshots/Listings%20page.png" alt="Listings" /></div><div className="cap"><h3>Every listing, one record</h3><p>Workflow, media, payments, property site, and revisions, all attached to the job itself.</p></div></div>
              <div className="shot"><div className="img"><img src="/screenshots/schedule.png" alt="Team schedule" /></div><div className="cap"><h3>Your team&apos;s whole week</h3><p>See who&apos;s shooting, who&apos;s free, and every photographer&apos;s next open slot at a glance.</p></div></div>
              <div className="shot"><div className="img"><img src="/screenshots/bookings.png" alt="Bookings" /></div><div className="cap"><h3>A booking page that sells</h3><p>Packages, add-ons, and instant scheduling, priced by square footage automatically.</p></div></div>
            </div>
          </div>
        </section>

        {/* AGENT KIT */}
        <section className="block">
          <div className="wrap">
            <div className="kit">
              <div>
                <span className="eyebrow">Agent marketing kit</span>
                <h2>Every agent gets a professional listing kit. <em>Automatically.</em></h2>
                <p className="lede">When you deliver a gallery, the agent gets everything they need to market the listing, with no extra work from you. It&apos;s a reason for them to keep booking you.</p>
                <div className="feats">
                  <div className="feat"><i>✓</i>Branded property website with full listing details</div>
                  <div className="feat"><i>✓</i>Print-ready brochure for open houses</div>
                  <div className="feat"><i>✓</i>QR code for print and signage</div>
                  <div className="feat"><i>✓</i>3D Matterport and video tour embedded</div>
                  <div className="feat"><i>✓</i>Private link, no agent account required</div>
                </div>
                <div style={{ marginTop: 32 }}><Link className="btn btn-ink" href="/auth/register">Get started</Link></div>
              </div>
              <div className="kcard">
                <div className="ph"><div><b>1842 Ocean View Dr</b><s>Listing kit · ready to share</s></div></div>
                <div className="body">
                  <div className="cell"><b>48</b><s>Photos</s></div>
                  <div className="cell"><b>2</b><s>Videos</s></div>
                  <div className="cell"><b>Live</b><s>Property site</s></div>
                  <div className="cell"><b>PDF</b><s>Brochure</s></div>
                  <div className="cell"><b>QR</b><s>Signage code</s></div>
                  <div className="cell"><b>3D</b><s>Tour embed</s></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="block" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow center">Loved by owners</span>
              <h2>Built for photographers who mean <em>business.</em></h2>
            </div>
            <div className="quotes">
              <div className="quote"><div className="stars">★★★★★</div><p>&quot;I used to spend half my Friday chasing down payment requests. Now the balance just shows up before I even think about it. The whole system runs itself.&quot;</p><div className="who"><span className="av" style={{ background: "var(--navy)" }}>MW</span><div><b>Marcus W.</b><s>Real estate photographer, San Diego CA</s></div></div></div>
              <div className="quote"><div className="stars">★★★★★</div><p>&quot;Assigning shoots to my team used to be a group text. Now I open the booking, see who is available, tap their name, and they get notified. Game changer.&quot;</p><div className="who"><span className="av" style={{ background: "var(--gold-dark)" }}>DT</span><div><b>Devon T.</b><s>Photography team owner, Phoenix AZ</s></div></div></div>
              <div className="quote"><div className="stars">★★★★★</div><p>&quot;I was nervous it would take forever to set up. I had my booking page live, Stripe connected, and my first real booking confirmed within the same afternoon.&quot;</p><div className="who"><span className="av" style={{ background: "var(--navy-2)" }}>BS</span><div><b>Brooke S.</b><s>Solo photographer, Nashville TN</s></div></div></div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="block" id="pricing" style={{ background: "var(--cream)" }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow center">Pricing</span>
              <h2>Everything you need to run your business, in <em>one</em> place.</h2>
              <p>Every plan includes booking, scheduling, galleries, contracts, payments, and the agent portal. No setup fees, no contracts.</p>
            </div>

            <div className="price-grid">
              {PRICE_PLANS.map((plan) => (
                <div key={plan.id} className={`plan${plan.featured ? " featured" : ""}`}>
                  {plan.featured && <div className="ribbon">Most popular</div>}
                  <div className="pn">{plan.name}</div>
                  <div className="pp">${PLANS[plan.id].monthlyPrice}<span>/mo</span></div>
                  <div className="pd">{plan.desc}</div>
                  <ul>
                    {plan.features.map((f) => (
                      <li key={f}><span className="ck">✓</span>{f}</li>
                    ))}
                  </ul>
                  <Link className={`btn ${plan.btn}`} href="/auth/register">Get Started</Link>
                </div>
              ))}
            </div>

            <div className="scale-bar">
              <div className="left">
                <div className="nm">Scale</div>
                <div className="ds">For large teams with high-volume operations.</div>
              </div>
              <div className="spec"><b>${PLANS.scale.monthlyPrice}</b><s>/mo</s></div>
              <div className="vd"></div>
              <div className="spec"><b>{PLANS.scale.activeListings.toLocaleString()}</b><s>Listing credits / year</s></div>
              <div className="vd"></div>
              <div className="spec"><b>{PLANS.scale.teamSeats}</b><s>Seats</s></div>
              <Link className="btn btn-gold btn-sm" href="/auth/register">Get Started</Link>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final">
          <div className="wrap">
            <div className="card">
              <span className="eyebrow center">Get started</span>
              <h2>Run your entire media business from <em>one</em> system.</h2>
              <p>Booking, scheduling, delivery, contracts, and payments. Everything connected and automated.</p>
              <Link className="btn btn-gold" href="/auth/register">Get Started</Link>
              <p className="micro">From ${PLANS.solo.monthlyPrice}/month. No contract. Cancel anytime.</p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="wrap">
            <div className="cols">
              <div>
                <Link className="logo" href="/" style={{ marginBottom: 16, display: "inline-flex" }}>
                  <img src="/kyoriaos-logo.png" alt="Kyoria OS" className="logo-img" />
                </Link>
                <p style={{ maxWidth: 270, fontSize: 13.5, lineHeight: 1.75, color: "var(--muted-2)" }}>The complete system for real estate photography businesses.</p>
              </div>
              <div>
                <h4>Features</h4>
                <a href="#features">Online booking</a>
                <a href="#features">Gallery delivery</a>
                <a href="#features">Property websites</a>
                <a href="#features">Agent portal</a>
                <a href="#features">Payments</a>
              </div>
              <div>
                <h4>Compare</h4>
                <Link href="/compare/aryeo-vs-kyoria-os">vs Aryeo</Link>
                <Link href="/compare/honeybook-vs-kyoria-os">vs HoneyBook</Link>
                <Link href="/compare/spiro-vs-kyoria-os">vs Spiro</Link>
              </div>
              <div>
                <h4>Company</h4>
                <Link href="/blog">Blog</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/contact-sales">Contact</Link>
              </div>
            </div>
            <div className="base">
              <span>© 2026 Kyoria OS. All rights reserved.</span>
              <span>Made for real estate media teams</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
