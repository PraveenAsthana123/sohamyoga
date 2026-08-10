'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import type { BlogCategory } from '@/lib/api';

interface BlogSearchProps {
  categories: BlogCategory[];
  currentCategory?: number;
  currentSearch?: string;
}

export default function BlogSearch({ categories, currentCategory, currentSearch }: BlogSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch || '');

  const updateParams = useCallback((key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/blog?${params.toString()}`);
  }, [router, searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams('search', search || undefined);
  };

  const handleCategoryClick = (categoryId: number | undefined) => {
    updateParams('categoryId', categoryId?.toString());
  };

  return (
    <div className="mb-10">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative max-w-xl mx-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="w-full px-5 py-3 pl-12 bg-white border border-dark-200 rounded-xl text-dark-800 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Category Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => handleCategoryClick(undefined)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            !currentCategory
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-white text-dark-600 border border-dark-200 hover:border-primary-300 hover:text-primary-600'
          }`}
        >
          All Posts
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              currentCategory === cat.id
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white text-dark-600 border border-dark-200 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
