import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  FilterOptions, 
  SearchOptions, 
  SortOption,
  searchEngine,
  SearchResult
} from './search-engine';
import type { GifMetadata } from '@/types/storage';

interface FilterControlsProps {
  gifs: GifMetadata[];
  onResultsChange: (results: GifMetadata[], searchResults?: SearchResult[]) => void;
  className?: string;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  gifs,
  onResultsChange,
  className = ''
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    fuzzySearch: true,
    threshold: 0.3,
    caseSensitive: false,
    searchFields: ['title', 'description', 'tags'],
  });

  // Filter state
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sort state
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  // Date range state
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Size range state (in MB)
  const [sizeRange, setSizeRange] = useState<[number, number]>([0, 100]);

  // Duration range state (in seconds)
  const [durationRange, setDurationRange] = useState<[number, number]>([0, 60]);

  // Resolution state
  const [resolutionFilter, setResolutionFilter] = useState<'all' | '360p' | '480p' | '720p' | '1080p' | '4k'>('all');

  // Tag filter state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Extract all unique tags from GIFs
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    gifs.forEach(gif => {
      gif.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [gifs]);

  // Apply search, filter, and sort
  const applyFilters = useCallback(() => {
    // Build filter options
    const filters: FilterOptions = {
      ...filterOptions,
      dateRange: (dateFrom || dateTo) ? {
        from: dateFrom ? new Date(dateFrom) : undefined,
        to: dateTo ? new Date(dateTo) : undefined,
      } : undefined,
      sizeRange: {
        min: sizeRange[0] * 1024 * 1024, // Convert MB to bytes
        max: sizeRange[1] * 1024 * 1024,
      },
      durationRange: {
        min: durationRange[0],
        max: durationRange[1],
      },
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    };

    // Apply resolution filter
    if (resolutionFilter !== 'all') {
      const resolutionRanges: Record<string, { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number }> = {
        '360p': { minWidth: 0, maxWidth: 640, minHeight: 0, maxHeight: 360 },
        '480p': { minWidth: 640, maxWidth: 854, minHeight: 360, maxHeight: 480 },
        '720p': { minWidth: 854, maxWidth: 1280, minHeight: 480, maxHeight: 720 },
        '1080p': { minWidth: 1280, maxWidth: 1920, minHeight: 720, maxHeight: 1080 },
        '4k': { minWidth: 1920, maxWidth: 9999, minHeight: 1080, maxHeight: 9999 },
      };
      filters.resolutionRange = resolutionRanges[resolutionFilter];
    }

    // Perform search, filter, and sort
    const { results, searchResults } = searchEngine.searchFilterSort(
      gifs,
      searchQuery,
      searchOptions,
      filters,
      sortOption
    );

    onResultsChange(results, searchResults);
  }, [
    gifs,
    searchQuery,
    searchOptions,
    filterOptions,
    dateFrom,
    dateTo,
    sizeRange,
    durationRange,
    resolutionFilter,
    selectedTags,
    sortOption,
    onResultsChange
  ]);

  // Apply filters on change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
  };

  const handleFuzzyToggle = () => {
    setSearchOptions(prev => ({
      ...prev,
      fuzzySearch: !prev.fuzzySearch
    }));
  };

  const handleCaseSensitiveToggle = () => {
    setSearchOptions(prev => ({
      ...prev,
      caseSensitive: !prev.caseSensitive
    }));
  };

  const handleAddTag = () => {
    if (tagInput && !selectedTags.includes(tagInput)) {
      setSelectedTags([...selectedTags, tagInput]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSearchOptions({
      fuzzySearch: true,
      threshold: 0.3,
      caseSensitive: false,
      searchFields: ['title', 'description', 'tags'],
    });
    setFilterOptions({});
    setSortOption('date-desc');
    setDateFrom('');
    setDateTo('');
    setSizeRange([0, 100]);
    setDurationRange([0, 60]);
    setResolutionFilter('all');
    setSelectedTags([]);
    setTagInput('');
    setShowAdvancedFilters(false);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (dateFrom || dateTo) count++;
    if (sizeRange[0] > 0 || sizeRange[1] < 100) count++;
    if (durationRange[0] > 0 || durationRange[1] < 60) count++;
    if (resolutionFilter !== 'all') count++;
    if (selectedTags.length > 0) count++;
    return count;
  }, [searchQuery, dateFrom, dateTo, sizeRange, durationRange, resolutionFilter, selectedTags]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main search bar and controls */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="Search GIFs..."
            value={searchQuery}
            onChange={handleSearchQueryChange}
            className="pr-20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button
              size="sm"
              variant={searchOptions.fuzzySearch ? 'default' : 'ghost'}
              onClick={handleFuzzyToggle}
              className="h-7 px-2 text-xs"
              title="Toggle fuzzy search"
            >
              Fuzzy
            </Button>
            <Button
              size="sm"
              variant={searchOptions.caseSensitive ? 'default' : 'ghost'}
              onClick={handleCaseSensitiveToggle}
              className="h-7 px-2 text-xs"
              title="Toggle case sensitive"
            >
              Aa
            </Button>
          </div>
        </div>

        <Select value={sortOption} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Sort by Relevance</SelectItem>
            <SelectItem value="date-desc">Date (Newest)</SelectItem>
            <SelectItem value="date-asc">Date (Oldest)</SelectItem>
            <SelectItem value="title-asc">Title (A-Z)</SelectItem>
            <SelectItem value="title-desc">Title (Z-A)</SelectItem>
            <SelectItem value="size-desc">Size (Largest)</SelectItem>
            <SelectItem value="size-asc">Size (Smallest)</SelectItem>
            <SelectItem value="duration-desc">Duration (Longest)</SelectItem>
            <SelectItem value="duration-asc">Duration (Shortest)</SelectItem>
          </SelectContent>
        </Select>

        <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <PopoverTrigger asChild>
            <Button variant={activeFilterCount > 0 ? 'default' : 'outline'}>
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 bg-background text-foreground rounded-full px-2 py-0.5 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="end">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Advanced Filters</h3>

              {/* Date range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1"
                  />
                  <span className="self-center">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Size range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  File Size: {sizeRange[0]}MB - {sizeRange[1]}MB
                </label>
                <Slider
                  value={sizeRange}
                  onValueChange={(value) => setSizeRange(value as [number, number])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Duration range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Duration: {durationRange[0]}s - {durationRange[1]}s
                </label>
                <Slider
                  value={durationRange}
                  onValueChange={(value) => setDurationRange(value as [number, number])}
                  min={0}
                  max={60}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Resolution filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <Select value={resolutionFilter} onValueChange={(value) => setResolutionFilter(value as typeof resolutionFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resolutions</SelectItem>
                    <SelectItem value="360p">Up to 360p</SelectItem>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p HD</SelectItem>
                    <SelectItem value="1080p">1080p Full HD</SelectItem>
                    <SelectItem value="4k">4K and above</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tag filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    className="flex-1"
                    list="tag-suggestions"
                  />
                  <datalist id="tag-suggestions">
                    {allTags
                      .filter(tag => !selectedTags.includes(tag))
                      .map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                  </datalist>
                  <Button onClick={handleAddTag} size="sm">
                    Add
                  </Button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-primary/10 text-primary"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Search fields */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search in:</label>
                <div className="flex flex-wrap gap-2">
                  {(['title', 'description', 'tags', 'youtubeUrl'] as const).map(field => (
                    <label key={field} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={searchOptions.searchFields?.includes(field) ?? false}
                        onChange={(e) => {
                          setSearchOptions(prev => ({
                            ...prev,
                            searchFields: e.target.checked
                              ? [...(prev.searchFields || []), field]
                              : prev.searchFields?.filter(f => f !== field)
                          }));
                        }}
                      />
                      {field === 'youtubeUrl' ? 'URL' : field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Reset button */}
              <div className="flex justify-between pt-2 border-t">
                <Button onClick={handleResetFilters} variant="ghost" size="sm">
                  Reset All
                </Button>
                <Button onClick={() => setShowAdvancedFilters(false)} size="sm">
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">Active filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
          {(dateFrom || dateTo) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary">
              Date: {dateFrom || '...'} to {dateTo || '...'}
            </span>
          )}
          {(sizeRange[0] > 0 || sizeRange[1] < 100) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary">
              Size: {sizeRange[0]}-{sizeRange[1]}MB
            </span>
          )}
          {(durationRange[0] > 0 || durationRange[1] < 60) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary">
              Duration: {durationRange[0]}-{durationRange[1]}s
            </span>
          )}
          {resolutionFilter !== 'all' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary">
              Resolution: {resolutionFilter}
            </span>
          )}
          {selectedTags.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary">
              Tags: {selectedTags.join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterControls;