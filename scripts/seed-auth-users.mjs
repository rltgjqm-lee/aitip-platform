/**
 * AITIP Platform - Auth User Seed CLI (ESM)
 * 비밀번호를 코드에 하드코딩하지 않고 환경변수로 받아 PBKDF2-SHA256 해시 SQL을 생성/적용합니다.
 *
 * 사용법 (PowerShell):
 *   $env:MART_ADMIN_PW="원하는비밀번호"; $env:SUPER_ADMIN_PW="원하는비밀번호"
 *   node scripts/seed-auth-users.mjs --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { hashPassword, nextAuthUid } from '../packages/core/shared/auth-crypto.mjs';

const applyRemote = process.argv.includes('--apply');
const applyLocal = process.argv.includes('--local');
const martPw = String(process.env.MART_ADMIN_PW || '').trim();
const superPw = String(process.env.SUPER_ADMIN_PW || '').trim();
const defaultMartId = String(process.env.DEFAULT_MART_ID || 'MRT-11-650-01-47121-0001').trim();

if (!martPw || !superPw) {
  console.error('[seed-auth-users] 환경변수 MART_ADMIN_PW 와 SUPER_ADMIN_PW (각 8자 이상)를 지정해 주세요.');
  process.exit(1);
}

const escSql = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function main() {
  const now = Date.now();
  const users = [
    {
      id: nextAuthUid('usr'),
      email: 'mart@aitip.com',
      display_name: '서초 하나로마트 점장',
      password_hash: await hashPassword(martPw),
      role: 'MART_ADMIN',
      mart_id: defaultMartId
    },
    {
      id: nextAuthUid('usr'),
      email: 'superking@aitip.com',
      display_name: 'AITIP 슈퍼관리자',
      password_hash: await hashPassword(superPw),
      role: 'SUPER_ADMIN',
      mart_id: null
    }
  ];

  const lines = [
    'PRAGMA foreign_keys = ON;',
    `INSERT OR IGNORE INTO mart_suppliers (id, mart_name, mart_type, status, created_at, updated_at) VALUES (${escSql(defaultMartId)}, '서초 하나로마트', 'NH_HANARO', 'ACTIVE', ${now}, ${now});`
  ];
  for (const u of users) {
    lines.push(`
INSERT INTO platform_users (
  id, email, display_name, password_hash, role, mart_id, status, created_at, updated_at
) VALUES (
  ${escSql(u.id)}, ${escSql(u.email)}, ${escSql(u.display_name)}, ${escSql(u.password_hash)},
  ${escSql(u.role)}, ${u.mart_id ? escSql(u.mart_id) : 'NULL'}, 'ACTIVE', ${now}, ${now}
)
ON CONFLICT(email) DO UPDATE SET
  display_name = excluded.display_name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  mart_id = excluded.mart_id,
  status = 'ACTIVE',
  updated_at = excluded.updated_at;`.trim());
  }

  const outDir = path.resolve('scratch');
  fs.mkdirSync(outDir, { recursive: true });
  const sqlFile = path.join(outDir, 'seed_auth_users.tmp.sql');
  fs.writeFileSync(sqlFile, lines.join('\n\n') + '\n', 'utf8');
  console.log(`[seed-auth-users] SQL 생성 완료: ${sqlFile} (${users.length}명)`);

  if (applyRemote || applyLocal) {
    const targetFlag = applyRemote ? '--remote' : '--local';
    const label = applyRemote ? '원격 D1' : '로컬 D1';
    try {
      execSync(`cmd /c "npx wrangler d1 execute aitip-core-db ${targetFlag} --file=${sqlFile}"`, { stdio: 'inherit' });
      console.log(`[seed-auth-users] ${label} 적용 완료.`);
    } finally {
      try { fs.unlinkSync(sqlFile); } catch (_) {}
    }
  } else {
    console.log('[seed-auth-users] 드라이런 모드입니다. 원격은 --apply, 로컬은 --local 옵션을 붙여 실행하세요.');
  }
}

main().catch(err => {
  console.error('[seed-auth-users] 실패:', err.message);
  process.exit(1);
});
