import { useEffect, useRef } from 'react';
import { socket } from './socket';
import { subscribeResource } from './live-events';
export default function useLiveRefresh(resource, refresh) {
  const current = useRef(refresh);
  useEffect(() => { current.current = refresh; });
  useEffect(() => {
    return subscribeResource(socket, resource, () => current.current());
  }, [resource]);
}
