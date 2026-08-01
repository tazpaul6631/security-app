export function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/** Ước lượng byte của raw base64 (không cần tạo Blob) */
export function estimateBase64ByteSize(base64: string): number {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export function previewToBase64Sync(preview: string): string | null {
  if (!preview.startsWith('data:image')) return null;
  const comma = preview.indexOf(',');
  return comma >= 0 ? preview.slice(comma + 1) : null;
}

export async function previewToBlob(preview: string): Promise<Blob> {
  const inline = previewToBase64Sync(preview);
  if (inline) {
    const mime =
      preview.startsWith('data:image/png') ? 'image/png'
        : preview.startsWith('data:image/webp') ? 'image/webp'
          : preview.startsWith('data:image/gif') ? 'image/gif'
            : 'image/jpeg';
    return base64ToBlob(inline, mime);
  }
  const response = await fetch(preview);
  return response.blob();
}

export async function previewToBase64(preview: string, submitBase64?: string): Promise<string> {
  if (submitBase64) return submitBase64;
  const inline = previewToBase64Sync(preview);
  if (inline) return inline;
  const blob = await previewToBlob(preview);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

export function mimeFromPreview(preview: string, blobType?: string): string {
  if (blobType && blobType.startsWith('image/')) return blobType;
  if (preview.startsWith('data:image/')) {
    const mime = preview.slice(5, preview.indexOf(';'));
    if (mime) return mime;
  }
  const lower = preview.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}
