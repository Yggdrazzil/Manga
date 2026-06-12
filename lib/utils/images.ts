/**
 * Webtoon covers (…-phinf.pstatic.net) are hotlink-protected: they 403
 * without a webtoons.com Referer. expo-image forwards per-source headers.
 */
export function coverSource(
  uri?: string | null,
): { uri: string; headers?: Record<string, string> } | undefined {
  if (!uri) return undefined;
  if (uri.includes('-phinf.pstatic.net')) {
    return { uri, headers: { Referer: 'https://www.webtoons.com/' } };
  }
  return { uri };
}
