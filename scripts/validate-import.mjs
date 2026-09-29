import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
const dir = process.argv[2];
const sql = postgres(process.env.DIRECT_URL, { max: 1 });
function parseCsv(text){const rows=[];let row=[],cell="",q=false;const s=text.replace(/^\uFEFF/,"");for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'){if(s[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}else if(c==='"')q=true;else if(c===","){row.push(cell);cell="";}else if(c==="\n"||c==="\r"){if(c==="\r"&&s[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(v=>v!==""))rows.push(row);row=[];}else cell+=c;}if(cell!==""||row.length){row.push(cell);if(row.some(v=>v!==""))rows.push(row);}const h=rows[0].map(x=>x.trim());return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,(r[i]??"").trim()])));}
const csv = readdirSync(dir).find(f=>/_all\.csv$/i.test(f));
const rows = parseCsv(readFileSync(path.join(dir,csv),"utf8"));
const norm = s => (s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
// 1. contagens por fase e status
const byStage = await sql`select s.name, count(*)::int as n from deals d join deal_stages s on s.id=d.stage_id group by s.name order by n desc`;
const byStatus = await sql`select status, count(*)::int as n from deals group by status`;
const owned = await sql`select count(*)::int as n from properties where status='owned'`;
const refs = await sql`select min(ref) as first, max(ref) as last, count(*)::int as n from properties`;
const docs = await sql`select d.name from documents d order by d.name`;
console.log("por fase:", byStage.map(r=>`${r.name} ${r.n}`).join(" | "));
console.log("por status:", byStatus.map(r=>`${r.status} ${r.n}`).join(" | "), "| imóveis comprados:", owned[0].n, "| refs:", refs[0].first, "→", refs[0].last, `(${refs[0].n})`);
console.log("documentos:", docs.map(d=>d.name).join(", "));
// 2. amostra de 10 linhas com morada, comparadas campo a campo
const withAddr = rows.filter(r=>r.Morada);
const sample = [3, 17, 40, 66, 90, 120, 150, 180, 200, 215].map(i=>withAddr[i % withAddr.length]);
let ok=0, bad=[];
for (const r of sample) {
  const addrN = norm(`${r.Morada} ${r.Freguesia}`);
  const [d] = await sql`select d.name, d.status, d.asking_price, d.next_action, d.listing_url, d.entered_at, s.name as stage, c.name as contact, p.typology, p.floor, p.parish, p.municipality from deals d join properties p on p.id=d.property_id join deal_stages s on s.id=d.stage_id left join contacts c on c.id=d.source_contact_id where p.address_normalized = ${addrN} order by d.seq desc limit 1`;
  if (!d) { bad.push(`${r.Morada}: não encontrado`); continue; }
  const price = r["Preço"] ? Number(r["Preço"].replace(/[€\s]/g,"").replace(/,/g,"")).toFixed(2) : null;
  const checks = [
    ["fase", norm(r.Score), norm(d.stage)],
    ["status", /exclu/i.test(r.Status)?"excluded":"active", d.status],
    ["preço", price, d.asking_price],
    ["próx. ação", r["Prox Ação"]||null, d.next_action],
    ["link", r.Link||null, d.listing_url],
    ["tipologia", r.Tipologia||null, d.typology],
    ["contacto", norm(r.Nome)||null, d.contact ? norm(d.contact) : null],
  ];
  const diffs = checks.filter(([,a,b]) => (a??null) !== (b??null) && !(a===null && b===null));
  if (diffs.length===0) ok++; else bad.push(`${r.Morada}: ` + diffs.map(([k,a,b])=>`${k} "${a}" vs "${b}"`).join("; "));
}
console.log(`amostra: ${ok}/10 iguais`);
bad.forEach(b=>console.log("  ✗ "+b));
await sql.end();
