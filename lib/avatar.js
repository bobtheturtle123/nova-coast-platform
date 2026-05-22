export function avatarColor(str) {
  const p = ["#3486cf","#1e6091","#2e7d32","#6a1b9a","#d84315","#00695c","#b5872d","#c0392b"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

export function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
