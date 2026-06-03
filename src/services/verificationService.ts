export interface VerificationResult {
  verificationId: string;
  timestamp: string;
  txId: string;
  level: 1 | 2 | 3;

  existence: {
    status: 'confirmed' | 'pending' | 'not_found';
    blockHeight: number | null;
    blockTimestamp: string | null;
    blockId: string | null;
    confirmations: number | null;
  };

  authenticity: {
    status: 'signature_verified' | 'hash_verified' | 'unverified';
    signatureValid: boolean | null;
    signatureSkipReason: string | null;
    dataHash: string | null;
    gatewayHash: string | null;
    hashMatch: boolean | null;
  };

  owner: {
    address: string | null;
    publicKey: string | null;
    addressVerified: boolean | null;
  };

  metadata: {
    dataSize: number | null;
    contentType: string | null;
    tags: Array<{ name: string; value: string }>;
  };

  bundle: {
    isBundled: boolean;
    rootTransactionId: string | null;
  };

  gatewayAssessment: {
    verified: boolean | null;
    stable: boolean | null;
    trusted: boolean | null;
    hops: number | null;
  };

  attestation: {
    operator: string;
    gateway: string;
    signature: string;
    payloadHash: string;
    attestedAt: string;
  } | null;

  links: {
    dashboard: string | null;
    pdf: string | null;
    rawData: string | null;
  };
}

export async function verifyTransaction(
  baseUrl: string,
  txId: string,
  signal?: AbortSignal
): Promise<VerificationResult> {
  const res = await fetch(`${baseUrl}/api/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txId }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data: VerificationResult = await res.json();
  // Defensive: ensure tags is always an array even if API omits it
  data.metadata.tags = data.metadata.tags ?? [];
  return data;
}

export function getPdfUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/api/v1/verify/${id}/pdf`;
}
