import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Readable } from 'node:stream';

// Fetches pages and feeds at addresses people type in. Golem runs next to other services,
// so anything that resolves to a private, loopback or otherwise internal address is
// refused, on every redirect and at connect time, so DNS can't be pointed inward after the
// check.

export class FeedError extends Error {}

const USER_AGENT = 'GolemBot/1.0 (+https://golem.rudeus.net)';
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

const blocked = new BlockList();
for (const [network, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
] as const) {
	blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
	// Unspecified, loopback and the old IPv4-compatible form (::127.0.0.1). IPv4-mapped
	// addresses (::ffff:7f00:1) need no rule: BlockList checks them against the IPv4 ones.
	['::', 96],
	['64:ff9b::', 96],
	['100::', 64],
	['2001:db8::', 32],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8]
] as const) {
	blocked.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) return !blocked.check(address, 'ipv4');
	if (family !== 6) return false;
	// IPv4 written as IPv6 (::ffff:10.0.0.1) is judged as the IPv4 address it is.
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
	if (mapped) return isPublicAddress(mapped[1]);
	return !blocked.check(address, 'ipv6');
}

// dns.lookup, minus internal addresses. http calls this for every connection.
function publicLookup(
	hostname: string,
	options: LookupOptions,
	callback: (
		error: NodeJS.ErrnoException | null,
		address: string | LookupAddress[],
		family?: number
	) => void
): void {
	lookup(hostname, { ...options, all: true }, (error, addresses) => {
		if (error) return callback(error, '');
		const safe = addresses.filter((entry) => isPublicAddress(entry.address));
		if (safe.length === 0 || safe.length !== addresses.length) {
			return callback(new FeedError(`${hostname} is not a public address.`), '');
		}
		if (options.all) callback(null, safe);
		else callback(null, safe[0].address, safe[0].family);
	});
}

function checkUrl(raw: string | URL): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new FeedError("That isn't a valid link.");
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new FeedError('Only http and https links can be followed.');
	}
	if (url.username || url.password) throw new FeedError("Links with passwords can't be followed.");
	// Literal addresses skip DNS, so they're checked here.
	const host = url.hostname.replace(/^\[|\]$/g, '');
	if (isIP(host) && !isPublicAddress(host)) throw new FeedError('That is not a public address.');
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
		throw new FeedError('That is not a public address.');
	}
	return url;
}

function decode(response: http.IncomingMessage): Readable {
	switch (response.headers['content-encoding']) {
		case 'gzip':
		case 'x-gzip':
			return response.pipe(createGunzip());
		case 'deflate':
			return response.pipe(createInflate());
		case 'br':
			return response.pipe(createBrotliDecompress());
		default:
			return response;
	}
}

export type Fetched = { url: URL; status: number; contentType: string; body: string };

function once(url: URL, headers: Record<string, string>, signal: AbortSignal) {
	return new Promise<{ response: http.IncomingMessage }>((resolve, reject) => {
		const request = (url.protocol === 'https:' ? https : http).get(url, {
			headers: {
				'user-agent': USER_AGENT,
				'accept-encoding': 'gzip, deflate, br',
				...headers
			},
			lookup: publicLookup,
			signal
		});
		request.once('response', (response) => resolve({ response }));
		request.once('error', reject);
	});
}

async function readBody(response: http.IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of decode(response)) {
		size += (chunk as Buffer).length;
		if (size > MAX_BYTES) {
			response.destroy();
			throw new FeedError('That page is too large to be a feed.');
		}
		chunks.push(chunk as Buffer);
	}
	const charset = /charset=["']?([\w-]+)/i.exec(response.headers['content-type'] ?? '')?.[1];
	try {
		return new TextDecoder(charset ?? 'utf-8').decode(Buffer.concat(chunks));
	} catch {
		return Buffer.concat(chunks).toString('utf8');
	}
}

export async function fetchPublic(
	raw: string | URL,
	headers: Record<string, string> = {}
): Promise<Fetched> {
	let url = checkUrl(raw);
	const signal = AbortSignal.timeout(TIMEOUT_MS);
	try {
		for (let redirects = 0; ; redirects++) {
			const { response } = await once(url, headers, signal);
			const status = response.statusCode ?? 0;
			const location = response.headers.location;
			if (status >= 300 && status < 400 && location) {
				response.resume();
				if (redirects >= MAX_REDIRECTS) throw new FeedError('That link redirects too many times.');
				url = checkUrl(new URL(location, url));
				continue;
			}
			return {
				url,
				status,
				contentType: response.headers['content-type'] ?? '',
				body: await readBody(response)
			};
		}
	} catch (error) {
		if (error instanceof FeedError) throw error;
		if (signal.aborted) throw new FeedError(`${url.hostname} took too long to answer.`);
		const code = (error as NodeJS.ErrnoException).code;
		if (code === 'ENOTFOUND') throw new FeedError(`${url.hostname} doesn't exist.`);
		throw new FeedError(`Couldn't reach ${url.hostname}.`, { cause: error });
	}
}
