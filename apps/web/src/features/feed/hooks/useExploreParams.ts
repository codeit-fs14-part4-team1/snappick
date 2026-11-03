import { Category, Style, Region } from '@snappick/shared';
import { FEED_SORTS } from '../types';
import type { FeedFilters } from './useExploreFeed';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const CATEGORIES = Object.values(Category);
const STYLES = Object.values(Style);
const REGIONS = Object.values(Region);
const KEYWORD_MAX_LENGTH = 50;

function pickOne<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((item) => item === value);
}

function keepAllowed<T extends string>(
  values: readonly string[],
  allowed: readonly T[],
): T[] {
  const picked = new Set(values);
  return allowed.filter((item) => picked.has(item));
}

function pickMany<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] {
  if (!value) return [];
  return keepAllowed(value.split(','), allowed);
}

function parseFilters(searchParams: URLSearchParams): FeedFilters {
  const keyword = searchParams
    .get('keyword')
    ?.trim()
    .slice(0, KEYWORD_MAX_LENGTH);
  return {
    category: pickOne(searchParams.get('category'), CATEGORIES),
    styles: pickMany(searchParams.get('styles'), STYLES),
    regions: pickMany(searchParams.get('regions'), REGIONS),
    sort: pickOne(searchParams.get('sort'), FEED_SORTS) ?? 'random',
    keyword: keyword || undefined,
  };
}
function toQueryString(filters: FeedFilters): string {
  const params = new URLSearchParams();
  const styles = keepAllowed(filters.styles ?? [], STYLES);
  const regions = keepAllowed(filters.regions ?? [], REGIONS);
  const keyword = filters.keyword?.trim().slice(0, KEYWORD_MAX_LENGTH);

  if (filters.category) params.set('category', filters.category);
  if (styles.length > 0) params.set('styles', styles.join(','));
  if (regions.length > 0) params.set('regions', regions.join(','));
  if (filters.sort && filters.sort !== 'random')
    params.set('sort', filters.sort);
  if (keyword) params.set('keyword', keyword);

  return params.toString();
}

export function useExploreParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = parseFilters(searchParams);

  function pushFilters(next: FeedFilters) {
    const query = toQueryString(next);
    router.push(query ? `${pathname}?${query}` : pathname);
  }
  function setFilters(changes: FeedFilters) {
    pushFilters({ ...filters, ...changes });
  }
  function resetRegions() {
    pushFilters({ ...filters, regions: [] });
  }
  function resetAll() {
    pushFilters({});
  }
  return { filters, setFilters, resetRegions, resetAll };
}
