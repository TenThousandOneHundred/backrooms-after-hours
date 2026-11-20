// Narrowband mono PCM. A 60 ms packet occupies 640 base64 characters on the room's JSON channel.
export const radioRate = 8000;
export const radioSamples = 480;
export function readRadioPacket(payload: unknown) {
  if (
    typeof payload !== 'string' ||
    payload.length !== (radioSamples * 4) / 3 ||
    !/^[A-Za-z0-9+/]+$/.test(payload)
  )
    return;
  const raw = atob(payload);
  const pcm = new Float32Array(radioSamples);
  for (let i = 0; i < pcm.length; i++) pcm[i] = (raw.charCodeAt(i) - 128) / 128;
  return pcm;
}
