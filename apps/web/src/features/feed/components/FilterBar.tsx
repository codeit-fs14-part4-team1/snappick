//filterBar : filters/setFilters를 받아서 각 필터 컨트롤의 value/onChange로 나눠준다

import { Category, Region, Style } from '@snappick/shared';
import {
  CategoryLabel,
  RegionLabel,
  StyleLabel,
} from '@/constants/enum-labels';
import Tabs, { TabItem } from '@/components/ui/Tabs';
import type { FeedFilters } from '../hooks/useExploreFeed';
import { KEYWORD_MAX_LENGTH } from '../types';
import styles from './FilterBar.module.css';
import SortSelect from './SortSelect';
import { FEED_SORTS, FeedSort } from '../types';
import StyleChips from './StyleChips';
import SearchBar from './SearchBar';
import RegionFilter from './RegionFilter';

type FilterBarProps = {
  filters: FeedFilters;
  setFilters: (changes: FeedFilters) => void;
  totalCount: string | undefined;
  onReset: () => void;
  resetCount: number;
};

//카테고리
const CATEGORIES = Object.values(Category);
const ALL_CATEGORY = 'ALL';
const CATEGORY_TABS: TabItem[] = [
  { value: ALL_CATEGORY, label: '전체' },
  ...CATEGORIES.map((category) => ({
    value: category,
    label: CategoryLabel[category],
  })),
];
//정렬
const SORT_LABEL = {
  random: '기본순',
  latest: '최신순',
  popular: '인기순',
} satisfies Record<FeedSort, string>;
const SORT_ITEMS = FEED_SORTS.map((sort) => ({
  value: sort,
  label: SORT_LABEL[sort],
}));
//스타일
const STYLES = Object.values(Style);
const STYLE_CHIPS: TabItem[] = STYLES.map((chip) => ({
  value: chip,
  label: StyleLabel[chip],
}));
//지역필터
const REGIONS = Object.values(Region);
const REGION_ITEMS: TabItem[] = REGIONS.map((region) => ({
  value: region,
  label: RegionLabel[region],
}));

export default function FilterBar({
  filters,
  setFilters,
  totalCount,
  onReset,
  resetCount,
}: FilterBarProps) {
  //카테고리 변경
  function changeCategory(value: string) {
    const category = CATEGORIES.find((item) => item === value);
    setFilters({ category });
  }
  function changeSort(value: string) {
    const sort = FEED_SORTS.find((item) => item === value);
    setFilters({ sort });
  }
  //기존 filters
  //스타일칩은 객체로 들어온 값에 대해서 이미 있으면 제거, 없으면 추가하여 다시 setFilters
  function toggleStyle(value: string) {
    const style = STYLES.find((item) => item === value);
    if (!style) return;

    const current = filters.styles ?? [];
    const next = current.includes(style)
      ? current.filter((item) => item !== style)
      : [...current, style];
    setFilters({ styles: next });
  }
  function submitKeyword(value: string) {
    setFilters({ keyword: value });
  }
  function applyRegions(values: string[]) {
    const regions = REGIONS.filter((region) => values.includes(region));
    setFilters({ regions });
  }
  return (
    <section className={styles.bar} aria-label="사진 탐색 조건">
      <SearchBar
        key={resetCount}
        initialKeyword={filters.keyword ?? ''}
        maxLength={KEYWORD_MAX_LENGTH}
        onSubmit={submitKeyword}
      />
      <Tabs
        className={styles.categories}
        items={CATEGORY_TABS}
        value={filters.category ?? ALL_CATEGORY}
        onValueChange={changeCategory}
        aria-label="카테고리"
      />

      <div className={styles.row}>
        <RegionFilter
          items={REGION_ITEMS}
          values={filters.regions ?? []}
          onApply={applyRegions}
        />
        <span className={styles.divider} aria-hidden="true" />
        <StyleChips
          items={STYLE_CHIPS}
          selectedValues={filters.styles ?? []}
          onToggle={toggleStyle}
        />
      </div>

      <div className={styles.summaryRow}>
        <div className={styles.summary}>
          {totalCount !== undefined && (
            <p className={styles.count}>
              사진 <strong>{totalCount}</strong>장
            </p>
          )}
          <button type="button" className={styles.reset} onClick={onReset}>
            필터 초기화
          </button>
        </div>
        <SortSelect
          items={SORT_ITEMS}
          value={filters.sort ?? 'random'}
          onValueChange={changeSort}
        />
      </div>
    </section>
  );
}
