function decodeMuLawSample(byte) {
  const value = (~byte) & 0xff;
  const sign = value & 0x80;
  const exponent = (value >> 4) & 0x07;
  const mantissa = value & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

export function twilioMulawToPcm24kBase64(payload) {
  const mulaw = Buffer.from(payload, 'base64');
  const output = Buffer.allocUnsafe(mulaw.length * 3 * 2);
  let offset = 0;

  for (let i = 0; i < mulaw.length; i += 1) {
    const current = decodeMuLawSample(mulaw[i]);
    const next = i + 1 < mulaw.length ? decodeMuLawSample(mulaw[i + 1]) : current;
    const oneThird = current + (next - current) / 3;
    const twoThirds = current + (2 * (next - current)) / 3;

    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(current))), offset);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(oneThird))), offset + 2);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(twoThirds))), offset + 4);
    offset += 6;
  }

  return output.toString('base64');
}
