// Shared image dimension validation utility
// Used to enforce minimum resolution before uploading business photos

export interface ImageDimensionResult {
  file: File;
  valid: boolean;
  width: number;
  height: number;
}

/**
 * Load an image File and return its natural dimensions.
 * Uses URL.createObjectURL which reads the header only (no heavy memory usage).
 */
export function validateImageDimensions(
  file: File,
  minWidth: number,
  minHeight?: number,
): Promise<ImageDimensionResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      resolve({
        file,
        valid: w >= minWidth && (minHeight == null || h >= minHeight),
        width: w,
        height: h,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, valid: false, width: 0, height: 0 });
    };

    img.src = url;
  });
}

/**
 * Validate a batch of image files. Returns passed and failed arrays.
 */
export async function filterImagesByMinWidth(
  files: File[],
  minWidth: number,
  minHeight?: number,
): Promise<{ passed: ImageDimensionResult[]; failed: ImageDimensionResult[] }> {
  const results = await Promise.all(
    files.map((f) => validateImageDimensions(f, minWidth, minHeight)),
  );
  return {
    passed: results.filter((r) => r.valid),
    failed: results.filter((r) => !r.valid),
  };
}

/**
 * Check that an image is portrait orientation (height >= width).
 * Returns the result with valid=true only if height >= width.
 */
export function validatePortraitOrientation(
  file: File,
): Promise<ImageDimensionResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      resolve({ file, valid: h >= w, width: w, height: h });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, valid: false, width: 0, height: 0 });
    };

    img.src = url;
  });
}

/**
 * Filter a batch of images, rejecting any that are landscape (wider than tall).
 * Recommended: 9:16 portrait aspect ratio (e.g. 1080x1920).
 */
export async function filterByPortraitOrientation(
  files: File[],
): Promise<{ passed: ImageDimensionResult[]; failed: ImageDimensionResult[] }> {
  const results = await Promise.all(
    files.map((f) => validatePortraitOrientation(f)),
  );
  return {
    passed: results.filter((r) => r.valid),
    failed: results.filter((r) => !r.valid),
  };
}
