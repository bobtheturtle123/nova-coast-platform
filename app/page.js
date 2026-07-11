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

// Landing styles ported from the Claude Design "Landing Page Hi-Fi" handoff.
const CSS = `
:root{
  --ink:#181B20; --ink-2:#23262D;
  --gold:#C9A96E; --gold-dark:#A8843F; --gold-soft:#F7F0E2;
  --bg:#FFFFFF; --bg-2:#F8F7F4; --bg-3:#F2F0EB;
  --muted:#6B7075; --muted-2:#9CA0A6; --line:#E9E7E1;
  --sage:#5F7A5A; --sage-soft:#ECF1EA;
  --clay:#BC6B4A; --clay-soft:#F8EDE7;
  --teal:#3E6B66; --teal-soft:#E7F0EE;
  --r:20px;
  --shadow:0 1px 2px rgba(24,27,32,0.04),0 8px 24px -8px rgba(24,27,32,0.08);
  --shadow-lg:0 24px 60px -20px rgba(24,27,32,0.18);
}
.lp *{box-sizing:border-box;margin:0;}
.lp{background:var(--bg);color:var(--ink);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15.5px;line-height:1.55;-webkit-font-smoothing:antialiased;letter-spacing:-0.011em;scroll-behavior:smooth;}
.lp a{text-decoration:none;color:inherit;}
.lp .wrap{max-width:1160px;margin:0 auto;padding:0 28px;}

.lp h1,.lp h2,.lp h3{letter-spacing:-0.03em;}
.lp .eyebrow{display:inline-block;font-size:12.5px;font-weight:600;color:var(--gold-dark);background:var(--gold-soft);padding:6px 14px;border-radius:99px;margin-bottom:18px;}

.lp .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:50px;padding:0 26px;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .15s;letter-spacing:-0.01em;}
.lp .btn-ink{background:var(--ink);color:#fff;}
.lp .btn-ink:hover{background:var(--ink-2);transform:translateY(-1px);}
.lp .btn-ghost{border-color:var(--line);background:#fff;color:var(--ink);}
.lp .btn-ghost:hover{border-color:var(--ink);}
.lp .btn-gold{background:var(--gold);color:#2A2008;}
.lp .btn-gold:hover{background:#BD9A5C;transform:translateY(-1px);}
.lp .btn-sm{height:42px;padding:0 18px;font-size:14px;border-radius:12px;}

/* NAV */
.lp .nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.85);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);}
.lp .nav .row{display:flex;align-items:center;justify-content:space-between;height:68px;}
.lp .logo{display:flex;align-items:center;gap:10px;}
.lp .logo .mark{width:34px;height:34px;border-radius:9px;background:var(--ink);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:17px;font-weight:800;}
.lp .logo .nm{font-size:16.5px;font-weight:700;}
.lp .logo-img{height:38px;width:auto;object-fit:contain;display:block;}
.lp .nav nav{display:flex;gap:28px;font-size:14px;font-weight:500;color:var(--muted);}
.lp .nav nav a:hover{color:var(--ink);}
.lp .nav .cta{display:flex;align-items:center;gap:12px;}
.lp .nav .signin{font-size:14px;font-weight:500;color:var(--muted);}
.lp .nav .signin:hover{color:var(--ink);}

/* HERO */
.lp .hero{padding:84px 0 0;background:linear-gradient(180deg,var(--bg-2),var(--bg));overflow:hidden;}
.lp .hero .inner{text-align:center;max-width:780px;margin:0 auto;}
.lp .hero h1{font-size:56px;font-weight:800;line-height:1.06;}
.lp .hero .lede{font-size:18.5px;color:var(--muted);max-width:600px;margin:22px auto 0;line-height:1.6;}
.lp .hero .ctas{display:flex;gap:12px;justify-content:center;margin-top:34px;}
.lp .hero .micro{margin-top:16px;font-size:13px;color:var(--muted-2);}

.lp .chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:34px;}
.lp .chip{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:500;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:99px;padding:8px 16px;box-shadow:0 1px 2px rgba(24,27,32,0.04);}
.lp .chip i{font-style:normal;color:var(--sage);font-weight:700;}

.lp .hero-shot{max-width:1020px;margin:56px auto -2px;background:#fff;border:1px solid var(--line);border-bottom:none;border-radius:24px 24px 0 0;box-shadow:var(--shadow-lg);overflow:hidden;}
.lp .hero-shot .bar{display:flex;align-items:center;gap:6px;padding:13px 18px;border-bottom:1px solid var(--line);background:var(--bg-2);}
.lp .hero-shot .bar i{width:10px;height:10px;border-radius:50%;font-style:normal;background:var(--line);}
.lp .hero-shot .bar .url{flex:1;max-width:340px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:8px;font-size:11.5px;color:var(--muted-2);text-align:center;padding:4px 12px;}
.lp .hero-shot .img{aspect-ratio:16/7.6;background:repeating-linear-gradient(45deg,rgba(24,27,32,0.025) 0 1px,transparent 1px 10px),linear-gradient(135deg,#F3F1EC,#EAE7DF);display:flex;align-items:center;justify-content:center;color:var(--muted-2);font-size:13px;letter-spacing:0.06em;text-transform:uppercase;overflow:hidden;}
.lp .hero-shot .img img,.lp .shot .img img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}

/* SECTIONS */
.lp section.block{padding:96px 0;}
.lp .sec-head{text-align:center;max-width:680px;margin:0 auto 56px;}
.lp .sec-head h2{font-size:38px;font-weight:800;line-height:1.12;}
.lp .sec-head p{color:var(--muted);font-size:16.5px;line-height:1.65;margin-top:14px;}

/* BEFORE/AFTER */
.lp .ba{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.lp .ba .col{border-radius:var(--r);padding:34px 32px;}
.lp .ba .before{background:var(--bg-2);border:1px solid var(--line);}
.lp .ba .after{background:var(--ink);color:#fff;}
.lp .ba .tag{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:20px;padding:5px 13px;border-radius:99px;}
.lp .ba .before .tag{background:var(--clay-soft);color:var(--clay);}
.lp .ba .after .tag{background:rgba(201,169,110,0.18);color:var(--gold);}
.lp .ba li{list-style:none;display:flex;gap:12px;padding:9px 0;font-size:14.5px;line-height:1.5;}
.lp .ba .before li{color:var(--muted);}
.lp .ba .before li i{font-style:normal;color:var(--clay);flex-shrink:0;font-weight:700;}
.lp .ba .after li{color:rgba(255,255,255,0.82);}
.lp .ba .after li i{font-style:normal;color:var(--gold);flex-shrink:0;font-weight:700;}

/* HOW IT WORKS */
.lp .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
.lp .step{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:28px 24px;transition:all .18s;box-shadow:var(--shadow);}
.lp .step:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg);}
.lp .step .num{width:34px;height:34px;border-radius:10px;background:var(--gold-soft);color:var(--gold-dark);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;}
.lp .step h3{font-size:16px;font-weight:700;margin:16px 0 8px;}
.lp .step p{font-size:13.5px;color:var(--muted);line-height:1.6;}

/* BENEFITS */
.lp .bens{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
.lp .ben{border-radius:var(--r);padding:28px 24px;transition:all .18s;}
.lp .ben.gold{background:var(--gold-soft);}
.lp .ben.sage{background:var(--sage-soft);}
.lp .ben.clay{background:var(--clay-soft);}
.lp .ben.teal{background:var(--teal-soft);}
.lp .ben:hover{transform:translateY(-4px);}
.lp .ben .ic{width:42px;height:42px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:18px;box-shadow:0 1px 3px rgba(24,27,32,0.08);}
.lp .ben.gold .ic{color:var(--gold-dark);}
.lp .ben.sage .ic{color:var(--sage);}
.lp .ben.clay .ic{color:var(--clay);}
.lp .ben.teal .ic{color:var(--teal);}
.lp .ben h3{font-size:15.5px;font-weight:700;margin-bottom:7px;}
.lp .ben p{font-size:13.5px;color:#55595E;line-height:1.6;}

/* SCREENSHOTS */
.lp .shots{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;}
.lp .shot{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:#fff;box-shadow:var(--shadow);transition:all .18s;}
.lp .shot:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg);}
.lp .shot .img{aspect-ratio:16/9;background:repeating-linear-gradient(45deg,rgba(24,27,32,0.03) 0 1px,transparent 1px 10px),linear-gradient(135deg,#F3F1EC,#E9E6DE);display:flex;align-items:center;justify-content:center;color:var(--muted-2);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;}
.lp .shot .cap{padding:20px 24px;}
.lp .shot .cap h3{font-size:15.5px;font-weight:700;}
.lp .shot .cap p{font-size:13.5px;color:var(--muted);margin-top:4px;line-height:1.6;}

/* AGENT KIT */
.lp .kit{background:var(--bg-2);border-radius:28px;padding:72px 64px;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;}
.lp .kit h2{font-size:34px;font-weight:800;line-height:1.14;}
.lp .kit .lede{color:var(--muted);font-size:15.5px;line-height:1.7;margin:16px 0 24px;}
.lp .kit .feats{display:flex;flex-direction:column;gap:12px;}
.lp .kit .feat{display:flex;gap:12px;font-size:14.5px;color:var(--ink);}
.lp .kit .feat i{font-style:normal;color:var(--sage);font-weight:700;flex-shrink:0;}
.lp .kcard{background:#fff;border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow-lg);border:1px solid var(--line);}
.lp .kcard .ph{aspect-ratio:16/8;background:linear-gradient(135deg,#2B2E36,#41454F);display:flex;align-items:flex-end;padding:18px;}
.lp .kcard .ph b{color:#fff;font-size:18px;font-weight:700;display:block;}
.lp .kcard .ph s{text-decoration:none;font-size:12px;color:rgba(255,255,255,0.6);}
.lp .kcard .body{padding:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.lp .kcard .cell{background:var(--bg-2);border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center;}
.lp .kcard .cell b{display:block;font-size:13px;}
.lp .kcard .cell s{text-decoration:none;font-size:10.5px;color:var(--muted-2);}

/* TESTIMONIALS */
.lp .quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.lp .quote{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:28px;display:flex;flex-direction:column;box-shadow:var(--shadow);}
.lp .quote .stars{color:var(--gold);font-size:13px;letter-spacing:2px;margin-bottom:16px;}
.lp .quote p{font-size:14.5px;color:#3C4046;line-height:1.7;flex:1;}
.lp .quote .who{margin-top:20px;padding-top:18px;border-top:1px solid var(--line);display:flex;align-items:center;gap:11px;}
.lp .quote .who .av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12.5px;font-weight:700;}
.lp .quote .who b{display:block;font-size:13.5px;}
.lp .quote .who s{text-decoration:none;font-size:12px;color:var(--muted-2);}

/* PRICING */
.lp .price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:920px;margin:0 auto;align-items:stretch;}
.lp .plan{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:32px 28px;display:flex;flex-direction:column;position:relative;box-shadow:var(--shadow);}
.lp .plan.featured{border:2px solid var(--ink);box-shadow:var(--shadow-lg);}
.lp .plan .ribbon{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--gold);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:5px 16px;border-radius:99px;}
.lp .plan .pn{font-size:14.5px;font-weight:700;}
.lp .plan .pp{font-size:42px;font-weight:800;letter-spacing:-0.04em;margin:12px 0 4px;}
.lp .plan .pp span{font-size:14px;font-weight:500;color:var(--muted-2);letter-spacing:0;}
.lp .plan .pd{font-size:13px;color:var(--muted);min-height:36px;}
.lp .plan ul{list-style:none;padding:0;margin:20px 0 24px;flex:1;display:flex;flex-direction:column;gap:10px;}
.lp .plan li{font-size:13.5px;display:flex;gap:9px;color:#46494E;}
.lp .plan .ck{color:var(--sage);font-weight:700;}
.lp .scale-bar{max-width:920px;margin:14px auto 0;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r);padding:24px 30px;display:flex;align-items:center;gap:30px;}
.lp .scale-bar .left{flex:1;}
.lp .scale-bar .nm{font-size:16px;font-weight:700;}
.lp .scale-bar .ds{font-size:13px;color:var(--muted);margin-top:3px;}
.lp .scale-bar .spec{text-align:center;}
.lp .scale-bar .spec b{display:block;font-size:20px;font-weight:800;letter-spacing:-0.02em;}
.lp .scale-bar .spec s{text-decoration:none;font-size:11px;color:var(--muted-2);}
.lp .scale-bar .vd{width:1px;height:36px;background:var(--line);}

/* FINAL CTA */
.lp .final{padding:40px 0 96px;}
.lp .final .card{background:var(--ink);border-radius:28px;text-align:center;padding:88px 40px;color:#fff;position:relative;overflow:hidden;}
.lp .final .card::before{content:'';position:absolute;inset:0;background:radial-gradient(600px 300px at 50% -10%,rgba(201,169,110,0.22),transparent 65%);}
.lp .final h2{font-size:42px;font-weight:800;line-height:1.1;max-width:620px;margin:0 auto 16px;position:relative;}
.lp .final p{color:rgba(255,255,255,0.6);max-width:460px;margin:0 auto 32px;font-size:16px;line-height:1.6;position:relative;}
.lp .final .micro{font-size:13px;color:rgba(255,255,255,0.35);margin-top:16px;}
.lp .final .btn{position:relative;}

/* FOOTER */
.lp .footer{border-top:1px solid var(--line);padding:56px 0 36px;font-size:13.5px;color:var(--muted);}
.lp .footer .cols{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:40px;padding-bottom:40px;border-bottom:1px solid var(--line);}
.lp .footer h4{color:var(--ink);font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px;}
.lp .footer a{display:block;padding:4px 0;color:var(--muted);}
.lp .footer a:hover{color:var(--ink);}
.lp .footer .base{display:flex;justify-content:space-between;padding-top:22px;font-size:12.5px;color:var(--muted-2);}

/* Mobile hamburger nav (hidden on desktop) */
.lp .lp-mnav{display:none;position:relative;}
.lp .lp-mnav-btn{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:none;background:transparent;color:var(--ink);cursor:pointer;border-radius:10px;}
.lp .lp-mnav-btn:active{background:rgba(0,0,0,0.05);}
.lp .lp-mnav-backdrop{position:fixed;inset:0;top:68px;background:rgba(15,23,42,0.35);z-index:60;}
.lp .lp-mnav-panel{position:fixed;top:68px;left:0;right:0;z-index:61;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 16px 40px rgba(0,0,0,0.12);display:flex;flex-direction:column;padding:10px 20px 20px;}
.lp .lp-mnav-panel a{display:block;padding:14px 4px;font-size:16px;font-weight:500;color:var(--ink);border-bottom:1px solid rgba(0,0,0,0.04);}
.lp .lp-mnav-panel a:last-child{border-bottom:none;}
.lp .lp-mnav-sep{height:8px;}
.lp .lp-mnav-panel .lp-mnav-cta{margin-top:10px;background:var(--ink);color:#fff;text-align:center;border-radius:12px;padding:14px;font-weight:600;border-bottom:none;}

@media(max-width:980px){
  .lp .hero h1{font-size:40px;}
  .lp .ba,.lp .shots,.lp .kit{grid-template-columns:1fr;}
  .lp .kit{padding:48px 32px;gap:40px;}
  .lp .steps,.lp .bens{grid-template-columns:1fr 1fr;}
  .lp .quotes,.lp .price-grid{grid-template-columns:1fr;}
  .lp .scale-bar{flex-direction:column;align-items:flex-start;gap:18px;}
  .lp .footer .cols{grid-template-columns:1fr 1fr;}
}

/* Tablet/large-phone: collapse the desktop nav into the hamburger */
@media(max-width:840px){
  .lp .nav nav{display:none;}
  .lp .nav .cta .signin{display:none;}
  .lp .lp-mnav{display:block;}
}

/* Phones: real one-column layout, readable type, full-width CTAs */
@media(max-width:640px){
  .lp .wrap{padding-left:18px;padding-right:18px;}
  .lp .hero{padding-top:48px;}
  .lp .hero h1{font-size:31px;line-height:1.15;letter-spacing:-0.02em;}
  .lp .hero .lede{font-size:16px;}
  .lp .ctas{flex-direction:column;align-items:stretch;}
  .lp .ctas .btn{width:100%;text-align:center;}
  .lp .chips{gap:8px;}
  .lp .chip{font-size:12px;padding:6px 10px;}
  .lp .steps,.lp .bens{grid-template-columns:1fr;}
  .lp .kit{padding:36px 20px;gap:28px;}
  .lp h2{font-size:26px;}
  .lp .footer .cols{grid-template-columns:1fr;}
  .lp .footer .base{flex-direction:column;gap:8px;}
  .lp .scale-bar{padding:24px 20px;}
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
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
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
              <span className="eyebrow">The complete system for real estate photography businesses</span>
              <h1>Stop juggling bookings, messages, and files across different tools.</h1>
              <p className="lede">Kyoria OS connects booking, scheduling, gallery delivery, and payments into one system, so you can stop patching tools together and start running a real business.</p>
              <div className="ctas">
                <Link className="btn btn-ink" href="/auth/register">Get Started</Link>
                <Link className="btn btn-ghost" href="/demo">Explore the live demo</Link>
              </div>
              <p className="micro">Replace your booking tools, delivery platforms, and client communication with one system.</p>
              <div className="chips">
                <span className="chip"><i>✓</i>Collect deposits automatically</span>
                <span className="chip"><i>✓</i>Schedule your team in seconds</span>
                <span className="chip"><i>✓</i>Deliver galleries instantly</span>
                <span className="chip"><i>✓</i>Get paid before downloads</span>
                <span className="chip"><i>✓</i>Give agents a full portal</span>
                <span className="chip"><i>✓</i>Sync your calendar</span>
              </div>
            </div>

            <div className="hero-shot">
              <div className="bar">
                <i></i><i></i><i></i>
                <span className="url">app.kyoriaos.com/dashboard</span>
              </div>
              <div className="img"><img src="/screenshots/Dashboard.png" alt="KyoriaOS dashboard" /></div>
            </div>
          </div>
        </section>

        {/* PROBLEM / BEFORE-AFTER */}
        <section className="block" style={{ background: "var(--bg-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <h2>You&apos;re running a media business<br />out of duct tape and iMessage.</h2>
              <p>Every tool disconnected. Every follow-up manual. There&apos;s a better way.</p>
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
                <li><i>✕</i>Build pricing tables in Google Docs</li>
                <li><i>✕</i>No marketing materials for agents</li>
              </div>
              <div className="col after">
                <span className="tag">With Kyoria OS</span>
                <li><i>✓</i>Deposit collected the moment they book</li>
                <li><i>✓</i>Gallery delivered in one click, locked until paid</li>
                <li><i>✓</i>Balance auto-collected before downloads unlock</li>
                <li><i>✓</i>Assign photographers from the dashboard</li>
                <li><i>✓</i>Gallery link re-sent on demand</li>
                <li><i>✓</i>Full revenue breakdown per listing</li>
                <li><i>✓</i>Guided booking flow upsells for you</li>
                <li><i>✓</i>Agent portal with brochure, QR code, and downloads</li>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="block" id="how-it-works">
          <div className="wrap">
            <div className="sec-head">
              <h2>Four steps. Every job, handled.</h2>
              <p>From first contact to final payment. The entire job cycle runs through one system.</p>
            </div>
            <div className="steps">
              <div className="step"><div className="num">1</div><h3>They book</h3><p>Clients pick a package on your branded booking page. Square footage sets the price. Deposit collected on the spot.</p></div>
              <div className="step"><div className="num">2</div><h3>You shoot</h3><p>Assign photographers from the dashboard. Schedules and reminders go out automatically.</p></div>
              <div className="step"><div className="num">3</div><h3>You deliver</h3><p>Upload once. Gallery, property website, and brochure are generated and sent in one click.</p></div>
              <div className="step"><div className="num">4</div><h3>You get paid</h3><p>Balance auto-collected before downloads unlock. No chasing, no awkward emails.</p></div>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="block" id="features" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <h2>Built to grow your business,<br />not just manage it.</h2>
            </div>
            <div className="bens">
              <div className="ben gold"><div className="ic">◆</div><h3>Branded everything</h3><p>Booking page, galleries, property sites, and emails carry your logo and colors. Clients see your brand, not ours.</p></div>
              <div className="ben sage"><div className="ic">▣</div><h3>Payments on autopilot</h3><p>Deposits at booking, balances at delivery, reminders in between. Stripe-powered, hands-off.</p></div>
              <div className="ben clay"><div className="ic">⬡</div><h3>Service-area routing</h3><p>Draw your zones on a map. Bookings inside a zone go to the photographers you&apos;ve assigned to it.</p></div>
              <div className="ben teal"><div className="ic">◎</div><h3>Agent self-serve portal</h3><p>Agents log in to view galleries, download media, request revisions, and rebook. You stay out of the inbox.</p></div>
            </div>
          </div>
        </section>

        {/* SCREENSHOTS */}
        <section className="block" style={{ background: "var(--bg-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <h2>Every part of your business,<br />in one dashboard.</h2>
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
                <h2>Every agent gets a professional listing kit. Automatically.</h2>
                <p className="lede">When you deliver a gallery, the agent gets everything they need to market the listing, with no extra work from you. It&apos;s a reason for them to keep booking you.</p>
                <div className="feats">
                  <div className="feat"><i>✓</i>Branded property website with full listing details</div>
                  <div className="feat"><i>✓</i>Print-ready brochure for open houses</div>
                  <div className="feat"><i>✓</i>QR code for print and signage</div>
                  <div className="feat"><i>✓</i>3D Matterport and video tour embedded</div>
                  <div className="feat"><i>✓</i>Private link, no agent account required</div>
                </div>
                <div style={{ marginTop: 30 }}><Link className="btn btn-ink" href="/auth/register">Get started</Link></div>
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
              <h2>Built for photographers who mean business.</h2>
            </div>
            <div className="quotes">
              <div className="quote"><div className="stars">★★★★★</div><p>&quot;I used to spend half my Friday chasing down payment requests. Now the balance just shows up in my account before I even think about it. The whole system runs itself.&quot;</p><div className="who"><span className="av" style={{ background: "var(--sage)" }}>MW</span><div><b>Marcus W.</b><s>Real estate photographer, San Diego CA</s></div></div></div>
              <div className="quote"><div className="stars">★★★★★</div><p>&quot;Assigning shoots to my team used to be a group text. Now I open the booking, see who is available, tap their name, and they get notified. Game changer for us.&quot;</p><div className="who"><span className="av" style={{ background: "var(--clay)" }}>DT</span><div><b>Devon T.</b><s>Photography team owner, Phoenix AZ</s></div></div></div>
              <div className="quote"><div className="stars">★★★★★</div><p>&quot;I was nervous it would take forever to set up. I had my booking page live, Stripe connected, and my first real booking confirmed within the same afternoon.&quot;</p><div className="who"><span className="av" style={{ background: "var(--teal)" }}>BS</span><div><b>Brooke S.</b><s>Solo photographer, Nashville TN</s></div></div></div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="block" id="pricing" style={{ background: "var(--bg-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <h2>Everything you need to run your business, in one place.</h2>
              <p>Every plan includes booking, scheduling, galleries, payments, and the agent portal. No setup fees, no contracts.</p>
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
              <Link className="btn btn-ink btn-sm" href="/auth/register">Get Started</Link>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final">
          <div className="wrap">
            <div className="card">
              <h2>Run your entire media business from one system.</h2>
              <p>Booking, scheduling, delivery, and payments. Everything connected and automated.</p>
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
                <Link className="logo" href="/" style={{ marginBottom: 14, display: "inline-flex" }}>
                  <img src="/kyoriaos-logo.png" alt="Kyoria OS" className="logo-img" />
                </Link>
                <p style={{ maxWidth: 260, fontSize: 13, lineHeight: 1.7, color: "var(--muted-2)" }}>The complete system for real estate photography businesses.</p>
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
