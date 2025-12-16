import { useState, useEffect } from 'react';
import { useDebouncedCallback } from '@/hooks/use-debounce';
import { searchSymbols } from '@/lib/stockbit-data';
import { WatchlistSymbol } from '@/lib/stockbit-types';

export function useSymbolSearch(token: string | null) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<WatchlistSymbol[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedSetSearchKeyword = useDebouncedCallback(setSearchKeyword, 300);

  useEffect(() => {
    if (!searchKeyword || !token) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const response = await searchSymbols(searchKeyword, token);
        // Convert search results to watchlist symbol format
        const symbols: WatchlistSymbol[] = response.data.company
          .filter((company) => company.type === 'Saham')
          .map((company) => ({
            symbol: company.name,
            symbol2: company.symbol_2,
            symbol3: company.symbol_3,
            country: company.country,
            exchange: company.exchange,
            status: parseInt(company.status),
            id: company.id,
            name: company.desc,
            sequence_no: 0,
            icon_url: company.icon_url,
            last: '',
            change: '',
            percent: '',
            previous: '',
            tradeable: company.is_tradeable,
            type: company.type,
            orderbook: { bid: '', offer: '' },
            prices: [],
            column: [],
            notations: [],
            uma: false,
            corp_action: { active: false, icon: '', text: '' },
            formatted_price: '',
            notation: [],
            volume: '',
            extra_attributes: null,
          }));
        setSearchResults(symbols);
      } catch (error) {
        console.error('Failed to search symbols', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    search();
  }, [searchKeyword, token]);

  return {
    searchKeyword,
    setSearchKeyword: debouncedSetSearchKeyword,
    searchResults,
    isSearching: loading,
  };
}
