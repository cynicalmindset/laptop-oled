export type ConversionOptions = {
  brightness: number; // -100 to 100
  contrast: number;   // 0 to 200
  invert: boolean;
  dither: boolean;
};

export function imageToOLED(
  image: HTMLImageElement,
  options: ConversionOptions = {
    brightness: 0,
    contrast: 100,
    invert: false,
    dither: true,
  }
): Uint8Array {

  const canvas = document.createElement("canvas");

  canvas.width = 128;
  canvas.height = 64;

  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    0,
    0,
    128,
    64
  );

  const imageData = ctx.getImageData(
    0,
    0,
    128,
    64
  );

  const data = imageData.data;

  // Convert to grayscale
  const gray = new Float32Array(128 * 64);

  for (let y = 0; y < 64; y++) {

    for (let x = 0; x < 128; x++) {

      const i = (y * 128 + x) * 4;

      let value =
        0.299 * data[i] +
        0.587 * data[i + 1] +
        0.114 * data[i + 2];

      // Brightness
      value += options.brightness;

      // Contrast
      value =
        ((value - 128) *
          (options.contrast / 100)) +
        128;

      // Clamp
      value = Math.max(
        0,
        Math.min(255, value)
      );

      if (options.invert) {
        value = 255 - value;
      }

      gray[y * 128 + x] = value;
    }
  }

  // Floyd-Steinberg dithering
  if (options.dither) {

    for (let y = 0; y < 64; y++) {

      for (let x = 0; x < 128; x++) {

        const index =
          y * 128 + x;

        const oldValue = gray[index];

        const newValue =
          oldValue >= 128 ? 255 : 0;

        gray[index] = newValue;

        const error =
          oldValue - newValue;

        if (x + 1 < 128) {
          gray[index + 1] +=
            error * 7 / 16;
        }

        if (x > 0 && y + 1 < 64) {
          gray[index + 127] +=
            error * 3 / 16;
        }

        if (y + 1 < 64) {
          gray[index + 128] +=
            error * 5 / 16;
        }

        if (
          x + 1 < 128 &&
          y + 1 < 64
        ) {
          gray[index + 129] +=
            error * 1 / 16;
        }
      }
    }
  }

  // Convert pixels → OLED bytes
  const output =
    new Uint8Array(1024);

  for (let y = 0; y < 64; y++) {

    for (let x = 0; x < 128; x++) {

      const value =
        gray[y * 128 + x];

      if (value >= 128) {

        const byteIndex =
          Math.floor(
            (y * 128 + x) / 8
          );

        const bit =
          7 -
          ((y * 128 + x) % 8);

        output[byteIndex] |=
          1 << bit;
      }
    }
  }

  return output;
}