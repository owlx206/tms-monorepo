import { createHash, randomInt } from 'crypto';

import { HttpError } from '../../../shared/errors/HttpError.js';

type CodeforcesPrimitive = string | number | boolean;

type CodeforcesApiEnvelope<T> = {
  status?: string;
  comment?: string;
  result?: T;
};

type ContestStandingsResult = {
  contest?: {
    id?: number;
    name?: string;
  };
};

type ContestStandingsFullResult = {
  contest?: {
    id?: number;
    name?: string;
  };
  problems?: Array<{
    index?: string;
    name?: string;
  }>;
  rows?: Array<{
    party?: {
      members?: Array<{
        handle?: string;
      }>;
    };
    problemResults?: Array<{
      points?: number;
      rejectedAttemptCount?: number;
      bestSubmissionTimeSeconds?: number;
    }>;
  }>;
};

const CODEFORCES_REQUEST_INTERVAL_MS = 2_000;

const HTML_ENTITY_BY_NAME: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  iacute: 'í',
  igrave: 'ì',
  oacute: 'ó',
  ograve: 'ò',
  ocirc: 'ô',
  otilde: 'õ',
  uacute: 'ú',
  ugrave: 'ù',
  yacute: 'ý',
};

let nextCodeforcesRequestAt = 0;
let codeforcesThrottleQueue = Promise.resolve();

export type CodeforcesCredentials = {
  apiKey: string;
  apiSecret: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForCodeforcesRequestSlot(): Promise<void> {
  const previous = codeforcesThrottleQueue;
  let releaseCurrentSlot: () => void = () => {};

  codeforcesThrottleQueue = new Promise<void>((resolve) => {
    releaseCurrentSlot = resolve;
  });

  await previous;

  try {
    const delayMs = Math.max(0, nextCodeforcesRequestAt - Date.now());
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    nextCodeforcesRequestAt = Date.now() + CODEFORCES_REQUEST_INTERVAL_MS;
  } finally {
    releaseCurrentSlot();
  }
}

function normalizeCredentialValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildSortedQuery(entries: Array<[string, string]>): string {
  return entries
    .slice()
    .sort((a, b) => {
      if (a[0] === b[0]) {
        return a[1].localeCompare(b[1]);
      }

      return a[0].localeCompare(b[0]);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function buildCodeforcesRequestQuery(
  methodName: string,
  params: Record<string, CodeforcesPrimitive>,
  credentials: CodeforcesCredentials | null,
): string {
  const entries = Object.entries(params).map(([key, value]) => [key, String(value)] as [string, string]);

  if (!credentials) {
    return buildSortedQuery(entries);
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  entries.push(['apiKey', credentials.apiKey]);
  entries.push(['time', timestamp]);

  const sortedQuery = buildSortedQuery(entries);
  const randomPrefix = randomInt(100000, 1_000_000).toString();
  const signatureSource = `${randomPrefix}/${methodName}?${sortedQuery}#${credentials.apiSecret}`;
  const hash = createHash('sha512').update(signatureSource).digest('hex');
  const apiSig = `${randomPrefix}${hash}`;

  return `${sortedQuery}&apiSig=${apiSig}`;
}

function parseCodeforcesError(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  if ('comment' in payload && typeof payload.comment === 'string' && payload.comment.trim().length > 0) {
    return payload.comment.trim();
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith('#x') || token.startsWith('#X')) {
      const codePoint = Number.parseInt(token.slice(2), 16);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    if (token.startsWith('#')) {
      const codePoint = Number.parseInt(token.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    return HTML_ENTITY_BY_NAME[token.toLowerCase()] ?? entity;
  });
}

export function resolveCodeforcesCredentials(
  apiKey: string | null | undefined,
  apiSecret: string | null | undefined,
): CodeforcesCredentials | null {
  const normalizedKey = normalizeCredentialValue(apiKey);
  const normalizedSecret = normalizeCredentialValue(apiSecret);

  if (!normalizedKey || !normalizedSecret) {
    return null;
  }

  return {
    apiKey: normalizedKey,
    apiSecret: normalizedSecret,
  };
}

export async function callCodeforcesApi<T>(
  methodName: string,
  params: Record<string, CodeforcesPrimitive>,
  credentials: CodeforcesCredentials | null,
): Promise<T> {
  await waitForCodeforcesRequestSlot();

  const queryString = buildCodeforcesRequestQuery(methodName, params, credentials);
  const requestUrl = `https://codeforces.com/api/${methodName}?${queryString}`;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'GET',
    });
  } catch {
    throw new HttpError('failed to connect to Codeforces API', 502);
  }

  if (!response.ok) {
    throw new HttpError('failed to sync metadata from Codeforces', 502);
  }

  let payload: CodeforcesApiEnvelope<T>;
  try {
    payload = await response.json() as CodeforcesApiEnvelope<T>;
  } catch {
    throw new HttpError('invalid response from Codeforces API', 502);
  }

  if (payload.status !== 'OK' || payload.result === undefined) {
    const detail = parseCodeforcesError(payload);
    throw new HttpError(detail ? `Codeforces API error: ${detail}` : 'Codeforces API error', 400);
  }

  return payload.result;
}

export function extractGymIdFromLink(gymLink: string): string | null {
  const match = /\/gym\/(\d+)/i.exec(gymLink);
  return match ? match[1] : null;
}

export async function fetchCodeforcesGymMetadata(
  gymId: string,
  credentials: CodeforcesCredentials | null,
): Promise<{ gym_id: string; title: string }> {
  const result = await callCodeforcesApi<ContestStandingsResult>(
    'contest.standings',
    {
      contestId: gymId,
      from: 1,
      count: 1,
    },
    credentials,
  );

  if (!result.contest?.id || typeof result.contest.name !== 'string' || result.contest.name.trim().length === 0) {
    throw new HttpError('invalid Codeforces gym metadata', 502);
  }

  return {
    gym_id: String(result.contest.id),
    title: decodeHtmlEntities(result.contest.name).trim(),
  };
}

export async function fetchCodeforcesGymStandings(
  gymId: string,
  credentials: CodeforcesCredentials | null,
): Promise<{
  gym_id: string;
  title: string;
  problems: Array<{ index: string; name: string | null }>;
  rows: Array<{
    handles: string[];
    problemResults: Array<{
      solved: boolean;
      penalty_minutes: number | null;
    }>;
  }>;
}> {
  const result = await callCodeforcesApi<ContestStandingsFullResult>(
    'contest.standings',
    {
      contestId: gymId,
      from: 1,
      count: 10000,
      showUnofficial: true,
    },
    credentials,
  );

  if (!result.contest?.id || typeof result.contest.name !== 'string' || result.contest.name.trim().length === 0) {
    throw new HttpError('invalid Codeforces gym standings', 502);
  }

  return {
    gym_id: String(result.contest.id),
    title: decodeHtmlEntities(result.contest.name).trim(),
    problems: (result.problems ?? [])
      .filter((problem) => typeof problem.index === 'string' && problem.index.trim().length > 0)
      .map((problem) => ({
        index: problem.index!.trim(),
        name: typeof problem.name === 'string' && problem.name.trim().length > 0
          ? decodeHtmlEntities(problem.name).trim()
          : null,
      })),
    rows: (result.rows ?? []).map((row) => ({
      handles: (row.party?.members ?? [])
        .map((member) => member.handle?.trim().toLowerCase())
        .filter((handle): handle is string => Boolean(handle)),
      problemResults: (row.problemResults ?? []).map((problemResult) => {
        const solved = typeof problemResult.points === 'number' && problemResult.points > 0;
        const bestSubmissionTimeSeconds = problemResult.bestSubmissionTimeSeconds;
        return {
          solved,
          penalty_minutes: solved && typeof bestSubmissionTimeSeconds === 'number'
            ? Math.max(0, Math.floor(bestSubmissionTimeSeconds / 60))
            : null,
        };
      }),
    })),
  };
}

export class CodeforcesClient {
  constructor(private readonly credentials: CodeforcesCredentials | null = null) {}

  call<T>(
    methodName: string,
    params: Record<string, CodeforcesPrimitive>,
  ): Promise<T> {
    return callCodeforcesApi<T>(methodName, params, this.credentials);
  }

  fetchGymMetadata(gymId: string): Promise<{ gym_id: string; title: string }> {
    return fetchCodeforcesGymMetadata(gymId, this.credentials);
  }

  fetchGymStandings(gymId: string): Promise<{
    gym_id: string;
    title: string;
    problems: Array<{ index: string; name: string | null }>;
    rows: Array<{
      handles: string[];
      problemResults: Array<{
        solved: boolean;
        penalty_minutes: number | null;
      }>;
    }>;
  }> {
    return fetchCodeforcesGymStandings(gymId, this.credentials);
  }
}
