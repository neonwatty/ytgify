import type { GifMetadata } from '@/types/storage';

export interface SearchOptions {
  fuzzySearch?: boolean;
  threshold?: number; // 0-1, where 0 is exact match and 1 is any match
  caseSensitive?: boolean;
  searchFields?: Array<'title' | 'description' | 'tags' | 'youtubeUrl'>;
  limit?: number;
}

export interface SearchResult {
  item: GifMetadata;
  score: number; // Relevance score (0-1)
  matches: {
    field: string;
    value: string;
    indices: Array<[number, number]>;
  }[];
}

export interface FilterOptions {
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  sizeRange?: {
    min?: number;
    max?: number;
  };
  durationRange?: {
    min?: number;
    max?: number;
  };
  resolutionRange?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
  tags?: string[];
  hasYoutubeUrl?: boolean;
}

export type SortOption = 'relevance' | 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc' | 'size-desc' | 'size-asc' | 'duration-desc' | 'duration-asc';

export class SearchEngine {
  private readonly defaultOptions: SearchOptions = {
    fuzzySearch: true,
    threshold: 0.3,
    caseSensitive: false,
    searchFields: ['title', 'description', 'tags'],
    limit: undefined,
  };

  /**
   * Calculate Levenshtein distance between two strings
   * Lower distance means more similar strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Empty string cases
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate normalized similarity score (0-1)
   * 1 = exact match, 0 = completely different
   */
  private calculateSimilarity(str1: string, str2: string, caseSensitive: boolean = false): number {
    if (!caseSensitive) {
      str1 = str1.toLowerCase();
      str2 = str2.toLowerCase();
    }

    // Exact match
    if (str1 === str2) return 1;

    // Contains match (substring)
    if (str1.includes(str2) || str2.includes(str1)) {
      const longerLength = Math.max(str1.length, str2.length);
      const shorterLength = Math.min(str1.length, str2.length);
      return 0.8 + (0.2 * (shorterLength / longerLength));
    }

    // Fuzzy match using Levenshtein distance
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Find matching indices in a string
   */
  private findMatchIndices(text: string, query: string, fuzzy: boolean = false): Array<[number, number]> {
    const indices: Array<[number, number]> = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (!fuzzy) {
      // Exact substring matching
      let startIndex = 0;
      while ((startIndex = lowerText.indexOf(lowerQuery, startIndex)) !== -1) {
        indices.push([startIndex, startIndex + query.length]);
        startIndex += query.length;
      }
    } else {
      // Fuzzy matching - find best matching subsequence
      const words = text.split(/\s+/);
      let currentIndex = 0;
      
      for (const word of words) {
        const similarity = this.calculateSimilarity(word, query, false);
        if (similarity > 0.6) {
          indices.push([currentIndex, currentIndex + word.length]);
        }
        currentIndex += word.length + 1;
      }
    }

    return indices;
  }

  /**
   * Search for GIFs based on query and options
   */
  search(
    gifs: GifMetadata[],
    query: string,
    options: SearchOptions = {}
  ): SearchResult[] {
    const opts = { ...this.defaultOptions, ...options };
    const results: SearchResult[] = [];

    if (!query || query.trim() === '') {
      // Return all items with default score if no query
      return gifs.map(gif => ({
        item: gif,
        score: 1,
        matches: []
      }));
    }

    const normalizedQuery = opts.caseSensitive ? query : query.toLowerCase();

    for (const gif of gifs) {
      let totalScore = 0;
      const matches: SearchResult['matches'] = [];
      let fieldCount = 0;

      // Search in title
      if (opts.searchFields?.includes('title') && gif.title) {
        const title = opts.caseSensitive ? gif.title : gif.title.toLowerCase();
        const score = opts.fuzzySearch
          ? this.calculateSimilarity(title, normalizedQuery, opts.caseSensitive)
          : (title.includes(normalizedQuery) ? 1 : 0);

        if (score > (opts.threshold || 0)) {
          totalScore += score * 2; // Title matches are weighted higher
          fieldCount++;
          const indices = this.findMatchIndices(gif.title, query, opts.fuzzySearch);
          if (indices.length > 0) {
            matches.push({
              field: 'title',
              value: gif.title,
              indices
            });
          }
        }
      }

      // Search in description
      if (opts.searchFields?.includes('description') && gif.description) {
        const description = opts.caseSensitive ? gif.description : gif.description.toLowerCase();
        const score = opts.fuzzySearch
          ? this.calculateSimilarity(description, normalizedQuery, opts.caseSensitive)
          : (description.includes(normalizedQuery) ? 1 : 0);

        if (score > (opts.threshold || 0)) {
          totalScore += score;
          fieldCount++;
          const indices = this.findMatchIndices(gif.description, query, opts.fuzzySearch);
          if (indices.length > 0) {
            matches.push({
              field: 'description',
              value: gif.description,
              indices
            });
          }
        }
      }

      // Search in tags
      if (opts.searchFields?.includes('tags') && gif.tags.length > 0) {
        let tagScore = 0;
        const tagMatches: Array<[string, number]> = [];

        for (const tag of gif.tags) {
          const normalizedTag = opts.caseSensitive ? tag : tag.toLowerCase();
          const score = opts.fuzzySearch
            ? this.calculateSimilarity(normalizedTag, normalizedQuery, opts.caseSensitive)
            : (normalizedTag.includes(normalizedQuery) ? 1 : 0);

          if (score > (opts.threshold || 0)) {
            tagScore = Math.max(tagScore, score);
            tagMatches.push([tag, score]);
          }
        }

        if (tagScore > 0) {
          totalScore += tagScore * 1.5; // Tag matches are weighted moderately
          fieldCount++;
          for (const [tag] of tagMatches) {
            matches.push({
              field: 'tags',
              value: tag,
              indices: [[0, tag.length]]
            });
          }
        }
      }

      // Search in YouTube URL
      if (opts.searchFields?.includes('youtubeUrl') && gif.youtubeUrl) {
        const url = opts.caseSensitive ? gif.youtubeUrl : gif.youtubeUrl.toLowerCase();
        const score = opts.fuzzySearch
          ? this.calculateSimilarity(url, normalizedQuery, opts.caseSensitive)
          : (url.includes(normalizedQuery) ? 1 : 0);

        if (score > (opts.threshold || 0)) {
          totalScore += score * 0.5; // URL matches are weighted lower
          fieldCount++;
          const indices = this.findMatchIndices(gif.youtubeUrl, query, opts.fuzzySearch);
          if (indices.length > 0) {
            matches.push({
              field: 'youtubeUrl',
              value: gif.youtubeUrl,
              indices
            });
          }
        }
      }

      // Calculate average score
      if (fieldCount > 0) {
        const avgScore = totalScore / fieldCount;
        if (avgScore > (opts.threshold || 0)) {
          results.push({
            item: gif,
            score: Math.min(avgScore, 1),
            matches
          });
        }
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.score - a.score);

    // Apply limit if specified
    if (opts.limit && opts.limit > 0) {
      return results.slice(0, opts.limit);
    }

    return results;
  }

  /**
   * Filter GIFs based on criteria
   */
  filter(gifs: GifMetadata[], options: FilterOptions): GifMetadata[] {
    let filtered = [...gifs];

    // Date range filter
    if (options.dateRange) {
      filtered = filtered.filter(gif => {
        const date = new Date(gif.createdAt);
        if (options.dateRange!.from && date < options.dateRange!.from) return false;
        if (options.dateRange!.to && date > options.dateRange!.to) return false;
        return true;
      });
    }

    // Size range filter
    if (options.sizeRange) {
      filtered = filtered.filter(gif => {
        if (options.sizeRange!.min !== undefined && gif.fileSize < options.sizeRange!.min) return false;
        if (options.sizeRange!.max !== undefined && gif.fileSize > options.sizeRange!.max) return false;
        return true;
      });
    }

    // Duration range filter
    if (options.durationRange) {
      filtered = filtered.filter(gif => {
        if (options.durationRange!.min !== undefined && gif.duration < options.durationRange!.min) return false;
        if (options.durationRange!.max !== undefined && gif.duration > options.durationRange!.max) return false;
        return true;
      });
    }

    // Resolution range filter
    if (options.resolutionRange) {
      filtered = filtered.filter(gif => {
        const { minWidth, maxWidth, minHeight, maxHeight } = options.resolutionRange!;
        if (minWidth !== undefined && gif.width < minWidth) return false;
        if (maxWidth !== undefined && gif.width > maxWidth) return false;
        if (minHeight !== undefined && gif.height < minHeight) return false;
        if (maxHeight !== undefined && gif.height > maxHeight) return false;
        return true;
      });
    }

    // Tag filter (any tag match)
    if (options.tags && options.tags.length > 0) {
      const lowerTags = options.tags.map(t => t.toLowerCase());
      filtered = filtered.filter(gif =>
        gif.tags.some(tag => lowerTags.includes(tag.toLowerCase()))
      );
    }

    // YouTube URL filter
    if (options.hasYoutubeUrl !== undefined) {
      filtered = filtered.filter(gif =>
        options.hasYoutubeUrl ? !!gif.youtubeUrl : !gif.youtubeUrl
      );
    }

    return filtered;
  }

  /**
   * Sort GIFs based on option
   */
  sort(gifs: GifMetadata[], option: SortOption, searchResults?: SearchResult[]): GifMetadata[] {
    const sorted = [...gifs];
    
    switch (option) {
      case 'relevance':
        // If we have search results, sort by score
        if (searchResults) {
          const scoreMap = new Map(searchResults.map(r => [r.item.id, r.score]));
          sorted.sort((a, b) => {
            const scoreA = scoreMap.get(a.id) || 0;
            const scoreB = scoreMap.get(b.id) || 0;
            return scoreB - scoreA;
          });
        }
        break;
      
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      
      case 'title-asc':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      
      case 'title-desc':
        sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      
      case 'size-desc':
        sorted.sort((a, b) => b.fileSize - a.fileSize);
        break;
      
      case 'size-asc':
        sorted.sort((a, b) => a.fileSize - b.fileSize);
        break;
      
      case 'duration-desc':
        sorted.sort((a, b) => b.duration - a.duration);
        break;
      
      case 'duration-asc':
        sorted.sort((a, b) => a.duration - b.duration);
        break;
    }

    return sorted;
  }

  /**
   * Combined search, filter, and sort operation
   */
  searchFilterSort(
    gifs: GifMetadata[],
    query: string,
    searchOptions: SearchOptions = {},
    filterOptions: FilterOptions = {},
    sortOption: SortOption = 'relevance'
  ): { results: GifMetadata[]; searchResults: SearchResult[] } {
    // First filter
    let results = this.filter(gifs, filterOptions);

    // Then search
    let searchResults: SearchResult[] = [];
    if (query) {
      searchResults = this.search(results, query, searchOptions);
      results = searchResults.map(r => r.item);
    }

    // Finally sort
    results = this.sort(results, sortOption, searchResults);

    return { results, searchResults };
  }
}

// Singleton instance
export const searchEngine = new SearchEngine();