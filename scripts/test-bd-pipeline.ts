/**
 * Live test of the BD consolidation pipeline against real APIs.
 * Run: npx tsx scripts/test-bd-pipeline.ts
 */
import { consolidateBDSeries } from '../lib/api/bdconsolidate';

const SERIES = [
  'Lanfeust de Troy',      // 8 tomes, classic — also tests confusion with "Lanfeust des Étoiles"
  'Thorgal',               // 40+ tomes, long-running
  'Le Chat du Rabbin',     // article + accents
  'Astérix',               // accented, many editions/re-editions
  'Blacksad',              // short series, Spanish authors
];

function pct(n: number, total: number) {
  return total === 0 ? '—' : `${Math.round((n / total) * 100)}%`;
}

async function main() {
  for (const title of SERIES) {
    const t0 = Date.now();
    try {
      const s = await consolidateBDSeries(title);
      const ms = Date.now() - t0;
      if (!s) {
        console.log(`\n━━━ ${title} — ${ms}ms — NULL (aucune source)`);
        continue;
      }
      const n = s.volumes.length;
      const withSubtitle = s.volumes.filter(v => v.subtitle).length;
      const withCover = s.volumes.filter(v => v.coverImage).length;
      const withDesc = s.volumes.filter(v => v.description).length;
      const withFrwiki = s.volumes.filter(v => v.frwikiTitle).length;
      const nums = s.volumes.map(v => v.num);
      const gaps: number[] = [];
      for (let i = 1; i <= (s.totalVolumes || 0); i++) if (!nums.includes(i)) gaps.push(i);

      console.log(`\n━━━ ${title} — ${ms}ms`);
      console.log(`  tomes: ${n} (totalVolumes=${s.totalVolumes})  gaps: ${gaps.length ? gaps.join(',') : 'none'}`);
      console.log(`  titres FR: ${pct(withSubtitle, n)}  covers: ${pct(withCover, n)}  synopsis/tome: ${pct(withDesc, n)}  frwiki (lazy): ${pct(withFrwiki, n)}`);
      console.log(`  synopsis série (wiki): ${s.description ? `${s.description.slice(0, 80)}…` : 'ABSENT'}`);
      console.log(`  auteurs: ${s.authors.join(', ') || 'ABSENT'}`);
      for (const v of s.volumes.slice(0, 6)) {
        console.log(`    T${v.num}: ${v.subtitle ?? '(pas de titre)'}  [cover:${v.coverImage ? 'Y' : 'n'} desc:${v.description ? 'Y' : 'n'} ed:${v.publisher || '?'}]`);
      }
      if (n > 6) console.log(`    … +${n - 6} tomes`);
    } catch (e) {
      console.log(`\n━━━ ${title} — FAILED: ${(e as Error).message}`);
    }
  }
}

main();
