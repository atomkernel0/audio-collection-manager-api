export class AlbumsFormatUtils {
  /**
   * Generates an AVIF version of the cover URL if the original is a JPG.
   * @param {string} cover - The original cover image URL.
   * @returns {string} The AVIF cover URL if applicable, otherwise the original URL.
   */
  static generateCoverAvif(cover: string): string {
    return cover.endsWith(".jpg") ? cover.replace(".jpg", ".avif") : cover;
  }

  /**
   * Formats a cover URL to ensure it's a fully qualified URL.
   * @param {string} cover - The cover image URL or path.
   * @returns {string} A fully qualified URL for the cover image.
   */
  static formatCoverUrl(cover: string): string {
    if (typeof cover !== "string" || cover.trim() === "") {
      return "";
    }
    if (!cover.startsWith("http") && !cover.startsWith("//")) {
      const cdnUrl = process.env.CDN_URL;
      if (!cdnUrl) {
        throw new Error("CDN_URL environment variable is not set.");
      }
      return encodeURI(`${cdnUrl}/${cover}`);
    }
    return cover;
  }
}
