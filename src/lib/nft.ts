import { PublicKey, type AccountInfo, type Connection } from '@solana/web3.js';
import { Buffer } from 'buffer';

import { mapLimit, rpcUrl, type Network } from './solana';

export type Nft = { mint: string; name: string; image: string | null; collection: string | null };

const METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export const ipfsToHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7).replace(/^ipfs\//, '')}` : u);

async function fetchJson(url: string, ms = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Helius gibi DAS destekli RPC'lerde sıkıştırılmış (cNFT) dahil tüm NFT'ler tek istekte gelir.
async function getNftsDas(network: Network, owner: string): Promise<Nft[] | null> {
  try {
    const res = await fetch(rpcUrl(network), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'sat', method: 'getAssetsByOwner', params: { ownerAddress: owner, page: 1, limit: 100 } }),
    });
    const j = await res.json();
    if (!Array.isArray(j?.result?.items)) return null;
    return j.result.items
      .filter((a: any) => !a.burnt && !/Fungible/i.test(a.interface ?? ''))
      .map((a: any) => ({
        mint: a.id,
        name: a.content?.metadata?.name || 'İsimsiz',
        image: a.content?.files?.[0]?.cdn_uri ?? (a.content?.links?.image ? ipfsToHttp(a.content.links.image) : null),
        collection: a.content?.metadata?.symbol || null,
      }));
  } catch {
    return null;
  }
}

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset);
  const value = buf
    .toString('utf8', offset + 4, offset + 4 + len)
    .replace(/\0/g, '')
    .trim();
  return [value, offset + 4 + len];
}

/** Metaplex Token Metadata hesabı: key(1) + updateAuthority(32) + mint(32) + name + symbol + uri (u32 uzunluk önekli). */
function parseMetadata(data: Buffer) {
  const [name, o1] = readString(data, 1 + 32 + 32);
  const [symbol, o2] = readString(data, o1);
  const [uri] = readString(data, o2);
  return { name, symbol, uri };
}

async function getNftsMetaplex(conn: Connection, mints: string[]): Promise<Nft[]> {
  const list = mints.slice(0, 60);
  const pdas = list.map(
    (m) => PublicKey.findProgramAddressSync([Buffer.from('metadata'), METADATA_PROGRAM.toBuffer(), new PublicKey(m).toBuffer()], METADATA_PROGRAM)[0],
  );
  const infos: (AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < pdas.length; i += 100) infos.push(...(await conn.getMultipleAccountsInfo(pdas.slice(i, i + 100))));
  const metas = list.flatMap((mint, i) => {
    const info = infos[i];
    if (!info) return [];
    try {
      return [{ mint, ...parseMetadata(Buffer.from(info.data)) }];
    } catch {
      return [];
    }
  });
  return mapLimit(metas, 4, async (m) => {
    const json = m.uri ? await fetchJson(ipfsToHttp(m.uri)) : null;
    return {
      mint: m.mint,
      name: m.name || json?.name || 'İsimsiz',
      image: typeof json?.image === 'string' ? ipfsToHttp(json.image) : null,
      collection: json?.collection?.name ?? (m.symbol || null),
    };
  });
}

export async function getNfts(conn: Connection, network: Network, owner: string, mints: string[]): Promise<Nft[]> {
  return (await getNftsDas(network, owner)) ?? (mints.length ? getNftsMetaplex(conn, mints) : []);
}
