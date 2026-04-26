const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || null;

// TTLs (seconds)
const TTL = {
  WRIKE_TIMELOGS:   10 * 60,   // 10 min — timelogs rarely change mid-day
  WRIKE_TASKS:      30 * 60,   // 30 min — task titles are stable
  WRIKE_CATEGORIES: 60 * 60,   // 1 hr   — categories almost never change
  WRIKE_FOLDERS:    60 * 60,   // 1 hr
  EMPLOYEES:         5 * 60,   // 5 min
  DASHBOARD:              60,  // 60 s   — dashboard is polled frequently
  COUNTS:                 30,  // 30 s   — nav badge counts
};

class CacheService {
  constructor() {
    this.client = null;
    this.available = false;

    if (!REDIS_URL) {
      console.log('[Cache] REDIS_URL not set — caching disabled (set it to enable Redis)');
      return;
    }

    try {
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
      });

      this.client.on('ready',   () => { this.available = true;  console.log('[Cache] Redis connected'); });
      this.client.on('error',   (e) => { this.available = false; console.warn('[Cache] Redis error:', e.message); });
      this.client.on('close',   () => { this.available = false; });

      this.client.connect().catch(() => {}); // non-blocking
    } catch (e) {
      console.warn('[Cache] Redis init failed:', e.message);
    }
  }

  async get(key) {
    if (!this.available) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async set(key, value, ttl) {
    if (!this.available) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch { /* silent */ }
  }

  async del(key) {
    if (!this.available) return;
    try { await this.client.del(key); } catch { /* silent */ }
  }

  // Delete all keys matching a glob pattern (uses SCAN — safe for production)
  async invalidatePattern(pattern) {
    if (!this.available) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch { /* silent */ }
  }

  // Wrap an async function with cache-aside logic
  async wrap(key, ttl, fn) {
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }
}

module.exports = new CacheService();
module.exports.TTL = TTL;
