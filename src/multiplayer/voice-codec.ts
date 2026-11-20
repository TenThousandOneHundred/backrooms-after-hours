// Offer and answer preferences are receiver-directed. Apply them on both ends of the voice call.
export function speechSdp(sdp: string) {
  return sdp.split(/(?=^m=)/m).map(section => {
    if (!section.startsWith('m=audio ')) return section;
    const opus = /^a=rtpmap:(\d+) opus\/48000(?:\/\d+)?\r?$/im.exec(section);
    if (!opus) return section;
    const lineEnd = section.includes('\r\n') ? '\r\n' : '\n';
    const fmtp = new RegExp('^a=fmtp:' + opus[1] + ' ([^\\r\\n]*)', 'm');
    const options = (section.match(fmtp)?.[1] ?? '').split(';').map(s => s.trim()).filter(Boolean);
    const keep = options.filter(s => !/^(?:maxaveragebitrate|usedtx|stereo)=/i.test(s));
    const line = 'a=fmtp:' + opus[1] + ' ' + [...keep, 'maxaveragebitrate=16000', 'usedtx=1', 'stereo=0'].join(';');
    if (fmtp.test(section)) section = section.replace(fmtp, line);
    else section = section.replace(opus[0].trimEnd(), opus[0].trimEnd() + lineEnd + line);
    // Forty-millisecond packets amortize RTP and TURN headers across two speech frames.
    if (/^a=ptime:/m.test(section)) return section.replace(/^a=ptime:\d+/m, 'a=ptime:40');
    return section.trimEnd() + lineEnd + 'a=ptime:40' + lineEnd;
  }).join('');
}
