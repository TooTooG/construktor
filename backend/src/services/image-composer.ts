import sharp from "sharp";

export async function composeDakimakuraPreview(params: {
  frontImageBuffer: Buffer;
  backImageBuffer: Buffer;
  width?: number;
  height?: number;
}) {
  const width = params.width ?? 1600;
  const height = params.height ?? 2200;
  const halfWidth = Math.floor(width / 2);

  const front = await sharp(params.frontImageBuffer)
    .resize({
      width: halfWidth,
      height,
      fit: "cover",
      position: "centre"
    })
    .png()
    .toBuffer();

  const back = await sharp(params.backImageBuffer)
    .resize({
      width: halfWidth,
      height,
      fit: "cover",
      position: "centre"
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#ffffff"
    }
  })
    .composite([
      { input: front, left: 0, top: 0 },
      { input: back, left: halfWidth, top: 0 }
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}
