'use client';

import { useContext } from 'react';
import { DatafeedContext, DatafeedContextValue } from '.';

/**
 * Hook to access the datafeed WebSocket connection state.
 * Returns connection status, authorization status, and any errors.
 */
const useDatafeedSocket = (): DatafeedContextValue => {
  const context = useContext(DatafeedContext);

  if (!context) {
    throw new Error('useDatafeedSocket must be used within a DatafeedProvider');
  }

  return context;
};

export default useDatafeedSocket;
