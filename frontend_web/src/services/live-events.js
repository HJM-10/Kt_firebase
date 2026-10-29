export function subscribeResource(socket, resource, refresh) {
  const update = event => { if (event?.resource === resource) refresh(); };
  const reconnect = () => refresh();
  socket.on('resource_changed', update);
  socket.on('connect', reconnect);
  socket.connect();
  return () => {
    socket.off('resource_changed', update);
    socket.off('connect', reconnect);
  };
}
