import config from '../../../../config.js';
import { AppDataSource } from '../../../../infrastructure/database/data-source.js';
import {
  findTeacherCodeforcesSyncConfig,
  listTeacherIdsForCodeforcesSync,
} from '../../../account/infrastructure/persistence/typeorm/Writer.js';
import {
  CodeforcesClient,
  CodeforcesGym,
  extractGymIdFromLink,
  resolveCodeforcesCredentials,
  type CodeforcesContestListItem,
  type CodeforcesCredentials,
  type CodeforcesGymSnapshot,
} from '../../../../infrastructure/external/codeforces/codeforces.js';
import { startSyncLoop, type SyncLoop } from '../../../../infrastructure/sync/sync-loop.js';
import { TypeOrmGymReader } from '../persistence/typeorm/Reader.js';
import { TypeOrmGymWriter } from '../persistence/typeorm/Writer.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type TeacherSyncConfig = {
  teacherId: number;
  credentials: CodeforcesCredentials;
  ownerHandle: string;
};

export type TeacherSyncResult = {
  teacherId: number;
  skipped: boolean;
  skipReason?: string;
  syncedCatalog: number;
  syncedStandings: number;
};

// ─── CodeforcesWorker ────────────────────────────────────────────────────────

/**
 * Orchestrates Codeforces data sync per teacher.
 *
 * Uses the `topics` table for everything:
 *   - Catalog entries: topics with class_id = NULL (synced gym info, not bound to a class)
 *   - Bound entries: topics with class_id != NULL (gym bound to a class, has standings)
 *
 * Workflow per teacher:
 *   1. Load credentials + codeforces_handle from TeacherCodeforcesCredential
 *   2. If credentials/handle incomplete → skip
 *   3. Fetch visible gyms → filter by preparedBy === ownerHandle
 *   4. Upsert catalog entries (class_id = NULL) in topics table, delete stale
 *   5. For each bound topic (class_id != NULL) → fetch standings → sync problems + standings
 *
 * Codeforces is the source of truth. Local entities are cache only.
 */
export class CodeforcesWorker {
  /**
   * Load and validate teacher's Codeforces config.
   * Returns null if credentials or handle are incomplete.
   */
  private async loadTeacherConfig(teacherId: number): Promise<TeacherSyncConfig | null> {
    const config = await findTeacherCodeforcesSyncConfig(teacherId);

    if (!config) {
      return null;
    }

    const credentials = resolveCodeforcesCredentials(
      config.codeforces_api_key,
      config.codeforces_api_secret,
    );

    if (!credentials) {
      return null;
    }

    const handle = config.codeforces_handle?.trim().toLowerCase();
    if (!handle) {
      return null;
    }

    return { teacherId, credentials, ownerHandle: handle };
  }

  /**
   * Sync all Codeforces data for a single teacher.
   */
  async syncTeacher(teacherId: number): Promise<TeacherSyncResult> {
    const skipResult = (reason: string): TeacherSyncResult => ({
      teacherId,
      skipped: true,
      skipReason: reason,
      syncedCatalog: 0,
      syncedStandings: 0,
    });

    if (!AppDataSource.isInitialized) {
      return skipResult('database_not_initialized');
    }

    // Step 1: Load and validate teacher config
    const config = await this.loadTeacherConfig(teacherId);
    if (!config) {
      return skipResult('incomplete_credentials');
    }

    const codeforcesGym = new CodeforcesGym(CodeforcesClient.getInstance(), config.credentials);
    const gymReader = new TypeOrmGymReader(AppDataSource.manager);
    const gymWriter = new TypeOrmGymWriter();
    const now = new Date();
    let syncedCatalog = 0;
    let syncedStandings = 0;

    // Step 2: Check credential health and fetch visible gyms for the credential owner.
    let ownedGyms: CodeforcesContestListItem[];
    try {
      ownedGyms = await codeforcesGym.getGymsByCredential(config.ownerHandle);
      console.log(
        `[codeforces-sync] teacher=${teacherId}, handle=${config.ownerHandle}, credential_health=ok, owned_gyms=${ownedGyms.length}`,
      );
    } catch (error) {
      console.warn(`[codeforces-sync] teacher=${teacherId}, credential_health=failed`, error);
      return skipResult('api_error');
    }

    // Step 3: Sync gym catalog (upsert catalog topics with class_id = NULL)
    try {
      syncedCatalog = await gymWriter.syncCodeforcesGymCatalog(teacherId, ownedGyms, now);
    } catch (error) {
      console.warn(`[codeforces-sync] teacher=${teacherId}, failed to sync gym catalog`, error);
    }

    // Step 4: Sync standings for bound topics (class_id IS NOT NULL)
    const boundTopics = await gymReader.listBoundCodeforcesGymsForTeacher(teacherId);

    if (boundTopics.length === 0) {
      console.log(`[codeforces-sync] teacher=${teacherId}, catalog=${syncedCatalog}, bound_topics=0`);
      return { teacherId, skipped: false, syncedCatalog, syncedStandings };
    }

    // Build a set of owned gym IDs for quick lookup
    const ownedGymIdSet = new Set(ownedGyms.map((g) => String(g.id)));

    // Cache standings per gym to avoid duplicate API calls
    const standingsCache = new Map<string, CodeforcesGymSnapshot | null>();

    for (const topic of boundTopics) {
      const gymId = topic.gym_id ?? extractGymIdFromLink(topic.gym_link);
      if (!gymId) {
        continue;
      }

      // Only sync standings for gyms we own
      if (!ownedGymIdSet.has(gymId)) {
        continue;
      }

      // Fetch or reuse cached standings
      if (!standingsCache.has(gymId)) {
        try {
          const standings = await codeforcesGym.getGymSnapshot(gymId);
          standingsCache.set(gymId, standings);
        } catch (error) {
          console.warn(`[codeforces-sync] teacher=${teacherId}, gym=${gymId}, failed to fetch standings`, error);
          standingsCache.set(gymId, null);
        }
      }

      const standings = standingsCache.get(gymId);
      if (!standings) {
        continue;
      }

      try {
        if (await gymWriter.syncCodeforcesGymStandingProjection({
          teacherId,
          gymId: topic.id,
          classId: topic.class_id,
          standings,
          pulledAt: now,
        })) {
          syncedStandings += 1;
        }
      } catch (error) {
        console.warn(`[codeforces-sync] teacher=${teacherId}, topic=${topic.id}, failed to sync standing`, error);
      }
    }

    console.log(
      `[codeforces-sync] teacher=${teacherId}, catalog=${syncedCatalog}, bound_topics=${boundTopics.length}, standings_synced=${syncedStandings}`,
    );

    return { teacherId, skipped: false, syncedCatalog, syncedStandings };
  }
}

// ─── Worker Entry Point ──────────────────────────────────────────────────────

export function startCodeforcesSyncWorker(): SyncLoop {
  const worker = new CodeforcesWorker();

  return startSyncLoop({
    name: 'codeforces',
    getDelayMs: async () => config.sync.intervalSeconds * 1000,
    run: async () => {
      const teacherIds = await listTeacherIdsForCodeforcesSync();

      let totalCatalog = 0;
      let totalStandings = 0;
      let skippedCount = 0;

      for (const teacherId of teacherIds) {
        const result = await worker.syncTeacher(teacherId);
        if (result.skipped) {
          skippedCount += 1;
        } else {
          totalCatalog += result.syncedCatalog;
          totalStandings += result.syncedStandings;
        }
      }

      if (teacherIds.length > 0) {
        console.log(
          `[sync] codeforces pass: teachers=${teacherIds.length}, skipped=${skippedCount}, catalog=${totalCatalog}, standings=${totalStandings}`,
        );
      }
    },
  });
}
