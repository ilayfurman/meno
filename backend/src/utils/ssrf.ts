import dns from 'node:dns/promises';
import net from 'node:net';
import ipaddr from 'ipaddr.js';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', '169.254.169.254']);

function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return true;
  const parsed = ipaddr.parse(ip);

  if (parsed.kind() === 'ipv6') {
    return parsed.range() !== 'unicast';
  }

  const range = parsed.range();
  return ['private', 'loopback', 'linkLocal', 'broadcast', 'carrierGradeNat', 'reserved', 'unspecified'].includes(
    range,
  );
}

export async function assertSafeTarget(hostname: string) {
  const lowerHost = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lowerHost)) {
    throw new Error(`Blocked host: ${hostname}`);
  }

  const resolved = await dns.lookup(hostname, { all: true });
  if (resolved.length === 0) {
    throw new Error('Host did not resolve.');
  }

  for (const record of resolved) {
    if (isPrivateIp(record.address)) {
      throw new Error('Blocked private or local network address.');
    }
  }
}

export function isHttpProtocol(protocol: string) {
  return protocol === 'http:' || protocol === 'https:';
}
