// Richtet das Cloudflare-Pages-Projekt und die Domain lesemappe.janemmel.de ein, falls noch nicht geschehen:
// Projekt anlegen, Domain an das Projekt hängen, CNAME in der Zone janemmel.de auf <projekt>.pages.dev.
// Läuft vor jedem Upload aus deploy.ps1; was schon da ist, bleibt unverändert.
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const project = "lesemappe-janemmel-de";
const zoneName = "janemmel.de";
const domain = `lesemappe.${zoneName}`;

if (!token || !account) {
  console.error("domain: CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID fehlen");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const api = async (url, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${url}`, { headers, ...init });
  const body = await res.json();
  return { ok: body.success, status: res.status, result: body.result, fehler: (body.errors || []).map((e) => `${e.code} ${e.message}`).join("; ") };
};

const pages = `/accounts/${account}/pages/projects`;
let p = await api(`${pages}/${project}`);
if (!p.ok) {
  p = await api(pages, { method: "POST", body: JSON.stringify({ name: project, production_branch: "main" }) });
  if (!p.ok) { console.error(`domain: Projekt ${project} nicht angelegt (${p.status}): ${p.fehler}`); process.exit(1); }
  console.log(`domain: Projekt ${project} angelegt`);
}

const domains = await api(`${pages}/${project}/domains`);
if (!domains.ok) { console.error(`domain: Domains nicht lesbar: ${domains.fehler}`); process.exit(1); }
if (domains.result.some((d) => d.name === domain)) {
  console.log(`domain: ${domain} ist schon eingerichtet`);
} else {
  const neu = await api(`${pages}/${project}/domains`, { method: "POST", body: JSON.stringify({ name: domain }) });
  if (!neu.ok) { console.error(`domain: ${domain} nicht angelegt: ${neu.fehler}`); process.exit(1); }
  console.log(`domain: ${domain} hinzugefügt (${neu.result?.status ?? "ok"})`);
}

const zone = await api(`/zones?name=${zoneName}`);
const zoneId = zone.ok ? zone.result?.[0]?.id : null;
if (!zoneId) { console.error(`domain: Zone ${zoneName} nicht lesbar: ${zone.fehler}`); process.exit(1); }
const target = `${project}.pages.dev`;
const dns = await api(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(domain)}`);
const vorhanden = dns.ok ? dns.result.find((r) => r.name === domain) : null;
if (vorhanden?.type === "CNAME" && vorhanden.content === target) {
  console.log(`domain: DNS ${domain} ist schon eingerichtet`);
} else if (vorhanden) {
  console.error(`domain: DNS ${domain} zeigt auf ${vorhanden.type} ${vorhanden.content}, nicht auf ${target} – bitte von Hand prüfen`);
  process.exit(1);
} else {
  const made = await api(`/zones/${zoneId}/dns_records`, {
    method: "POST", body: JSON.stringify({ type: "CNAME", name: domain, content: target, proxied: true, ttl: 1 }),
  });
  if (!made.ok) { console.error(`domain: DNS ${domain} nicht angelegt: ${made.fehler}`); process.exit(1); }
  console.log(`domain: DNS ${domain} → ${target} angelegt`);
}
