export function twilioMedia(streamSid, payload) {
  return JSON.stringify({
    event: 'media',
    streamSid,
    media: { payload },
  });
}

export function twilioClear(streamSid) {
  return JSON.stringify({
    event: 'clear',
    streamSid,
  });
}

export function twilioMark(streamSid, name) {
  return JSON.stringify({
    event: 'mark',
    streamSid,
    mark: { name },
  });
}
