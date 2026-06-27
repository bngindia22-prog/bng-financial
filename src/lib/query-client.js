import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			retry: 1,
			staleTime: 1000 * 60 * 5, // 5 min before refetch
			gcTime: 1000 * 60 * 60 * 24 * 7, // keep cached data for 7 days
		},
	},
});

export const queryPersister = createSyncStoragePersister({
	storage: typeof window !== 'undefined' ? window.localStorage : undefined,
	key: 'bng-financial-cache',
	maxSize: 50, // max 50 queries persisted
});