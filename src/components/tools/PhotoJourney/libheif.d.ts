declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    display(image: ImageData, callback: (result: ImageData | null) => void): void;
    free(): void;
  }
  interface HeifDecoder { decode(buffer: Uint8Array): HeifImage[]; decoder: number }
  export default function initialize(): Promise<{
    HeifDecoder: new () => HeifDecoder;
    heif_context_free(context: number): void;
  }>;
}
