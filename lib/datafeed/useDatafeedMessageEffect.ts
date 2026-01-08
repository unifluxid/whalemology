'use client';

import { useContext, useEffect } from 'react';
import { DatafeedContext, DatafeedAction, DatafeedMessageChannel } from '.';

/**
 * Hook to subscribe to a specific datafeed message channel.
 * The action callback will be called whenever a message arrives on that channel.
 *
 * @param channel - The message channel to subscribe to (e.g., 'runningTradeBatch')
 * @param key - Unique identifier for this subscription (for deduplication)
 * @param action - Callback function to handle incoming messages
 * @param saveData - Whether to register/save this action (default true)
 */
const useDatafeedMessageEffect = (
  channel: keyof DatafeedMessageChannel,
  key: string,
  action?: DatafeedAction,
  saveData: boolean = true
) => {
  const { setAction, removeAction } = useContext(DatafeedContext);

  useEffect(() => {
    if (action && saveData) {
      setAction(channel, key, action);
    } else {
      removeAction(channel, key);
    }

    return () => removeAction(channel, key);
  }, [channel, key, action, saveData, setAction, removeAction]);
};

export default useDatafeedMessageEffect;
