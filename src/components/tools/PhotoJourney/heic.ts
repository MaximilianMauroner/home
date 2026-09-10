let decoderModule: ReturnType<typeof loadDecoder> | undefined;
async function loadDecoder() {
  const { default: initialize } = await import('libheif-js/libheif-wasm/libheif-bundle.mjs');
  return initialize();
}
/** This module and its WASM dependency are loaded only for HEIC/HEIF inputs. */
export async function decodeHeic(file: Blob): Promise<Blob> {
  const lib = await (decoderModule ??= loadDecoder());
  const decoder = new lib.HeifDecoder();
  const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
  try {
    const image = images.find((item) => item.is_primary()) ?? images[0];
    if (!image) throw new Error('The HEIC file has no readable image.');
    const canvas = document.createElement('canvas');
    canvas.width = image.get_width();
    canvas.height = image.get_height();
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not decode HEIC.');
    const pixels = await new Promise<ImageData>((resolve, reject) => {
      image.display(context.createImageData(canvas.width, canvas.height), (result) => {
        if (result) resolve(result);
        else reject(new Error('The HEIC image could not be decoded.'));
      });
    });
    context.putImageData(pixels, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The HEIC preview could not be prepared.'));
    }, 'image/jpeg', 0.94));
  } finally {
    images.forEach((image) => image.free());
    if (decoder.decoder) lib.heif_context_free(decoder.decoder);
  }
}
