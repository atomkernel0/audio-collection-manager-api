import axios from "axios";
import { getAverageColor } from "fast-average-color-node";
import { logger } from "../..";

export class ImageColorUtils {
  private static imageCache = new Map<string, string>();

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  private static rgbToHex(r: number, g: number, b: number): string {
    return (
      "#" +
      ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
    );
  }

  private static isColorTooLight(r: number, g: number, b: number): boolean {
    let brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 200;
  }

  private static darkenColor(
    r: number,
    g: number,
    b: number,
    amount: number
  ): { r: number; g: number; b: number } {
    return {
      r: Math.max(0, r - amount),
      g: Math.max(0, g - amount),
      b: Math.max(0, b - amount),
    };
  }

  public static async getAverageColorHex(coverURL: string): Promise<string> {
    if (this.imageCache.has(coverURL)) {
      return this.imageCache.get(coverURL)!;
    }

    try {
      const response = await axios.get(coverURL, {
        responseType: "arraybuffer",
      });
      const buffer = Buffer.from(response.data, "binary");
      const color = await getAverageColor(buffer, {
        algorithm: "dominant",
      });
      let hex = color.hex;
      const { r, g, b } = this.hexToRgb(hex);

      if (this.isColorTooLight(r, g, b)) {
        const darkened = this.darkenColor(r, g, b, 70);
        hex = this.rgbToHex(darkened.r, darkened.g, darkened.b);
      }

      this.imageCache.set(coverURL, hex);

      return hex;
    } catch (error) {
      logger.error("Error while extracting average color:", error);
      throw error;
    }
  }
}
