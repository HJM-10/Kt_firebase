import { useEffect, useRef } from 'react';
import { socket } from './socket';
export default function useLiveRefresh(resource, refresh) {
  const current = useRef(refresh);
  useEffect(() => { current.current = refresh; });
  useEffect(() => {
    const update = event => { if (event.resource === resource) current.current(); };
    const reconnect = () => current.current();
    socket.connect(); socket.on('resource_changed', update); socket.on('connect', reconnect);
    return () => { socket.off('resource_changed', update); socket.off('connect', reconnect); };
  }, [resource]);
}
