/**
 * AITIP Customer PWA - Zero-PII IndexedDB Local Identity Store (ESM)
 * 개인정보를 서버 DB에 저장하지 않고, 브라우저 IndexedDB에 익명 고객 UID(cust_...)만 영속 보관합니다.
 */

const DB_NAME = 'aitip_customer_zero_pii';
const STORE_NAME = 'identity';
const UID_KEY = 'customer_uid';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function generateCustomerUid() {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `cust_${ts}_${rand}`;
}

export async function getOrCreateCustomerUid() {
  try {
    const db = await openDb();
    const existing = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(UID_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (existing) return existing;

    const created = generateCustomerUid();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(created, UID_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return created;
  } catch (_) {
    const fallbackKey = 'aitip_customer_uid_fallback';
    const saved = localStorage.getItem(fallbackKey);
    if (saved) return saved;
    const created = generateCustomerUid();
    localStorage.setItem(fallbackKey, created);
    return created;
  }
}
