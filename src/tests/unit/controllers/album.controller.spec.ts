/**
 * @file album.controller.spec.ts
 * @description Unit tests for AlbumController using Bun test and TypeScript.
 * Follows best practices, AAA pattern, and includes comprehensive test coverage.
 */

import { describe, expect, it, beforeEach, mock, Mock } from "bun:test";
import type { Context } from "koa";
import { AlbumService } from "@/services/album.service";
import { AlbumController } from "@/controllers/album.controller";
import type { IAlbum, ISongWithAlbumInfo } from "@/interfaces/album.interface";
import { MusicGenre } from "@/interfaces/album.interface";
import { createMockContext } from "@/tests/utils/mock-context";

// Types for mocks
type MockedAlbumService = {
  [K in keyof AlbumService]: Mock<AlbumService[K]>;
};

// Mock the logger
mock.module("@/utils/logger", () => ({
  logger: {
    error: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  },
}));

describe("AlbumController (unit tests)", () => {
  let albumServiceMock: MockedAlbumService;
  let albumController: AlbumController;
  let ctx: Context;

  beforeEach(() => {
    // Arrange: create mock instances
    albumServiceMock = {
      getAllAlbums: mock(() => Promise.resolve([])),
      getAlbumsByOrder: mock(() => Promise.resolve([])),
      getAlbumById: mock(() => Promise.resolve(null)),
      searchAlbums: mock(() => Promise.resolve([])),
      getArtists: mock(() => Promise.resolve([])),
      getMostListenedAlbums: mock(() => Promise.resolve([])),
      getPrimaryColor: mock(() => Promise.resolve("")),
      getRandomAlbums: mock(() => Promise.resolve([])),
      searchSongs: mock(() => Promise.resolve([])),
      getAlbumsByArtist: mock(() =>
        Promise.resolve({ albums: [], randomSongs: [], totalSongs: 0 })
      ),
      getAlbumsByGenre: mock(() => Promise.resolve([])),
    };

    albumController = new AlbumController(
      albumServiceMock as unknown as AlbumService
    );
    ctx = createMockContext();
  });

  /**
   * @test Suite for getAlbums()
   */
  describe("getAlbums()", () => {
    it("should return albums on success", async () => {
      // Arrange
      const mockAlbums = [
        {
          _id: "1",
          title: "Test Album",
          artist: ["Test Artist"],
          songs: [
            {
              title: "Test Song",
              file: "Test File",
            },
          ],
          cover: "test-cover.jpg",
          coverAvif: "test-cover.avif",
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ];

      albumServiceMock.getAllAlbums.mockImplementation(() =>
        Promise.resolve(mockAlbums as IAlbum[])
      );

      // Act
      await albumController.getAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: mockAlbums });
      expect(albumServiceMock.getAllAlbums).toHaveBeenCalledTimes(1);
    });

    it("should handle errors and return 500", async () => {
      // Arrange
      albumServiceMock.getAllAlbums.mockImplementation(() =>
        Promise.reject(new Error("DB Error"))
      );

      // Act
      await albumController.getAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
      expect(albumServiceMock.getAllAlbums).toHaveBeenCalled();
    });
  });

  /**
   * @test Suite for getAlbumsByOrder()
   */
  describe("getAlbumsByOrder()", () => {
    it("should retrieve albums in sorted order with valid pagination", async () => {
      // Arrange
      ctx.query.page = "2";
      ctx.query.limit = "5";
      const mockAlbums = [
        {
          _id: "2",
          title: "Sorted Album",
          artist: ["Test Artist"],
          songs: [
            {
              title: "Test Song",
              file: "Test File",
            },
          ],
          cover: "test-cover.jpg",
          coverAvif: "test-cover.avif",
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ];
      albumServiceMock.getAlbumsByOrder.mockImplementation(() =>
        Promise.resolve(mockAlbums as IAlbum[])
      );

      // Act
      await albumController.getAlbumsByOrder(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: mockAlbums });
      expect(albumServiceMock.getAlbumsByOrder).toHaveBeenCalledWith(2, 5);
    });

    it("should use default pagination when query params are not provided", async () => {
      // Arrange
      const mockAlbums = [
        {
          _id: "3",
          title: "Default Page Album",
          artist: ["Test Artist"],
          songs: [
            {
              title: "Test Song",
              file: "Test File",
            },
          ],
          cover: "test-cover.jpg",
          coverAvif: "test-cover.avif",
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ];
      albumServiceMock.getAlbumsByOrder.mockImplementation(() =>
        Promise.resolve(mockAlbums as IAlbum[])
      );

      // Act
      await albumController.getAlbumsByOrder(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: mockAlbums });
      // page defaults to 1, limit defaults to 50
      expect(albumServiceMock.getAlbumsByOrder).toHaveBeenCalledWith(1, 50);
    });

    it("should handle errors and return 500", async () => {
      // Arrange
      albumServiceMock.getAlbumsByOrder.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.getAlbumsByOrder(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for getAlbum()
   */
  describe("getAlbum()", () => {
    it("should return album data when albumId is valid", async () => {
      // Arrange
      ctx.query.albumId = "valid-id";
      const mockAlbum = {
        _id: "valid-id",
        title: "Mock Album",
        artist: ["Mock Artist"],
        cover: "mock-cover.jpg",
        lang: "EN",
        songs: [
          { title: "Song 1", file: "song1.mp3" },
          { title: "Song 2", file: "song2.mp3" },
        ],
      };
      albumServiceMock.getAlbumById.mockImplementation(() =>
        Promise.resolve(mockAlbum as IAlbum)
      );

      // Act
      await albumController.getAlbum(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        _id: "valid-id",
        title: "Mock Album",
        artist: ["Mock Artist"],
        cover: "mock-cover.jpg",
        lang: "EN",
        songs: [
          {
            title: "Song 1",
            file: "song1.mp3",
            albumTitle: "Mock Album",
            albumArtist: ["Mock Artist"],
            albumCover: "mock-cover.jpg",
            albumLang: "EN",
            albumId: "valid-id",
          },
          {
            title: "Song 2",
            file: "song2.mp3",
            albumTitle: "Mock Album",
            albumArtist: ["Mock Artist"],
            albumCover: "mock-cover.jpg",
            albumLang: "EN",
            albumId: "valid-id",
          },
        ],
      });
    });

    it("should return 400 if albumId is missing or invalid", async () => {
      // Arrange
      ctx.query.albumId = ""; // invalid

      // Act
      await albumController.getAlbum(ctx);

      // Assert
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: "Invalid Album ID" });
      expect(albumServiceMock.getAlbumById).not.toHaveBeenCalled();
    });

    it("should return 404 if album not found", async () => {
      // Arrange
      ctx.query.albumId = "not-found";
      albumServiceMock.getAlbumById.mockImplementation(() =>
        Promise.resolve(null)
      );

      // Act
      await albumController.getAlbum(ctx);

      // Assert
      expect(ctx.status).toBe(404);
      expect(ctx.body).toEqual({ error: "Album not found" });
    });

    it("should return 500 on error", async () => {
      // Arrange
      ctx.query.albumId = "42";
      albumServiceMock.getAlbumById.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.getAlbum(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for searchAlbums()
   */
  describe("searchAlbums()", () => {
    it("should return albums for a given search query", async () => {
      // Arrange
      ctx.query.q = "Rock";
      const mockAlbums = [
        {
          _id: "1",
          title: "Rock Album",
          artist: ["Rock Artist"],
          songs: [
            {
              title: "Rock Song",
              file: "rock.mp3",
            },
          ],
          cover: "rock-cover.jpg",
          coverAvif: "rock-cover.avif",
          lang: "en",
          genre: [MusicGenre.RAC],
        },
      ];
      albumServiceMock.searchAlbums.mockImplementation(() =>
        Promise.resolve(mockAlbums as IAlbum[])
      );

      // Act
      await albumController.searchAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: mockAlbums });
      expect(albumServiceMock.searchAlbums).toHaveBeenCalledWith("Rock");
    });

    it("should handle errors and return 500", async () => {
      // Arrange
      albumServiceMock.searchAlbums.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.searchAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for getArtists()
   */
  describe("getArtists()", () => {
    it("should return 200 and list of artists", async () => {
      // Arrange
      const mockArtists = [
        {
          name: "ArtistOne",
          totalSongs: 10,
          totalAlbums: 2,
          representativeCover: "cover.jpg",
        },
      ];
      albumServiceMock.getArtists.mockImplementation(() =>
        Promise.resolve(mockArtists)
      );

      // Act
      await albumController.getArtists(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ artists: mockArtists });
      expect(albumServiceMock.getArtists).toHaveBeenCalledTimes(1);
    });

    it("should return 500 on error", async () => {
      // Arrange
      albumServiceMock.getArtists.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.getArtists(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for getMostListenedAlbums()
   */
  describe("getMostListenedAlbums()", () => {
    it("should return 404 if no albums found", async () => {
      // Arrange
      albumServiceMock.getMostListenedAlbums.mockImplementation(() =>
        Promise.resolve([])
      );

      // Act
      await albumController.getMostListenedAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(404);
      expect(ctx.body).toEqual({ error: "No albums found" });
    });

    it("should return 200 and albums if found", async () => {
      // Arrange
      const mockAlbums = [
        {
          _id: "1",
          title: "Popular Album",
          artist: ["Popular Artist"],
          songs: [
            {
              title: "Popular Song",
              file: "popular.mp3",
            },
          ],
          cover: "popular-cover.jpg",
          coverAvif: "popular-cover.avif",
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ];
      albumServiceMock.getMostListenedAlbums.mockImplementation(() =>
        Promise.resolve(mockAlbums as IAlbum[])
      );

      // Act
      await albumController.getMostListenedAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: mockAlbums });
    });

    it("should handle errors and return 500", async () => {
      // Arrange
      albumServiceMock.getMostListenedAlbums.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.getMostListenedAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for getPrimaryColor()
   */
  describe("getPrimaryColor()", () => {
    it("should return 400 if coverURL is not provided", async () => {
      // Arrange
      ctx.query.coverURL = "";

      // Act
      await albumController.getPrimaryColor(ctx);

      // Assert
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({
        error: "Invalid request: Please provide a coverURL",
      });
      expect(albumServiceMock.getPrimaryColor).not.toHaveBeenCalled();
    });

    it("should return 200 and the extracted color", async () => {
      // Arrange
      ctx.query.coverURL = `${process.env.CDN_URL}/cover.jpg`;
      albumServiceMock.getPrimaryColor.mockImplementation(() =>
        Promise.resolve("#FFFFFF")
      );

      // Act
      await albumController.getPrimaryColor(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ betterDominantColor: "#FFFFFF" });
      expect(albumServiceMock.getPrimaryColor).toHaveBeenCalled();
    });

    it("should handle specific invalid URL errors with 400", async () => {
      // Arrange
      ctx.query.coverURL = `${process.env.CDN_URL}/invalid.jpg`;
      albumServiceMock.getPrimaryColor.mockImplementation(() =>
        Promise.reject(new Error("Invalid URL"))
      );

      // Act
      await albumController.getPrimaryColor(ctx);

      // Assert
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: "Invalid URL" });
    });

    it("should handle other errors with 500", async () => {
      // Arrange
      ctx.query.coverURL = `${process.env.CDN_URL}/error.jpg`;
      albumServiceMock.getPrimaryColor.mockImplementation(() =>
        Promise.reject(new Error("Some other error"))
      );

      // Act
      await albumController.getPrimaryColor(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for getRandomAlbums()
   */
  describe("getRandomAlbums()", () => {
    it("should return 200 and random albums", async () => {
      // Arrange
      const mockAlbums = [
        {
          _id: "random",
          title: "Random Album",
          artist: ["Random Artist"],
          songs: [
            {
              title: "Random Song",
              file: "random.mp3",
            },
          ],
          cover: "random-cover.jpg",
          coverAvif: "random-cover.avif",
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ];
      albumServiceMock.getRandomAlbums.mockImplementation(() =>
        Promise.resolve(mockAlbums as IAlbum[])
      );

      // Act
      await albumController.getRandomAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: mockAlbums });
      expect(albumServiceMock.getRandomAlbums).toHaveBeenCalledTimes(1);
    });

    it("should handle errors and return 500", async () => {
      // Arrange
      albumServiceMock.getRandomAlbums.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.getRandomAlbums(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for searchSongs()
   */
  describe("searchSongs()", () => {
    it("should return 200 and matching songs", async () => {
      // Arrange
      ctx.query.song = "Term";
      const mockSongs: ISongWithAlbumInfo[] = [
        {
          title: "Term Song",
          albumId: "id",
          albumTitle: "Album Title",
          albumArtist: ["Someone"],
          file: "path/to/file.mp3",
          albumCover: "cover.jpg",
          albumLang: "fr",
        },
      ];

      albumServiceMock.searchSongs.mockImplementation(() =>
        Promise.resolve(mockSongs)
      );

      // Act
      await albumController.searchSongs(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ songs: mockSongs });
      expect(albumServiceMock.searchSongs).toHaveBeenCalledWith("Term");
    });

    it("should handle errors and return 500", async () => {
      // Arrange
      albumServiceMock.searchSongs.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.searchSongs(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for getAlbumsByArtist()
   */
  describe("getAlbumsByArtist()", () => {
    it("should return 200 and the artist's albums, randomSongs, totalSongs", async () => {
      // Arrange
      ctx.params.artist = "TestArtist";
      const serviceResult = {
        albums: [
          {
            _id: "album1",
            title: "Album1",
            artist: ["TestArtist"],
            cover: "test-cover.jpg",
            lang: "fr",
            songLength: 3, // Ajout du champ manquant
          },
        ],
        randomSongs: [
          {
            title: "Random Song",
            file: "random.mp3",
            albumId: "album1",
            albumTitle: "Album1",
            albumArtist: ["TestArtist"],
            albumCover: "test-cover.jpg",
            albumLang: "fr",
          },
        ],
        totalSongs: 12,
      };

      albumServiceMock.getAlbumsByArtist.mockImplementation(() =>
        Promise.resolve(serviceResult)
      );

      // Act
      await albumController.getAlbumsByArtist(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        albums: serviceResult.albums,
        artistRandomSongs: serviceResult.randomSongs,
        totalSongs: serviceResult.totalSongs,
      });
    });

    it("should return 400 if artist name is invalid or empty", async () => {
      // Arrange
      ctx.params.artist = "   ";

      // Act
      await albumController.getAlbumsByArtist(ctx);

      // Assert
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: "Invalid artist name" });
      expect(albumServiceMock.getAlbumsByArtist).not.toHaveBeenCalled();
    });

    it("should return 500 on error", async () => {
      // Arrange
      ctx.params.artist = "TestArtist";
      albumServiceMock.getAlbumsByArtist.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.getAlbumsByArtist(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });

  /**
   * @test Suite for getAlbumsByGenre()
   */
  describe("getAlbumsByGenre()", () => {
    it("should return 400 if genre is invalid", async () => {
      // Arrange
      ctx.query.genre = "Unknown";

      // Act
      await albumController.getAlbumsByGenre(ctx);

      // Assert
      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: "Invalid genre parameter" });
      expect(albumServiceMock.getAlbumsByGenre).not.toHaveBeenCalled();
    });

    it("should return 200 and albums if valid genre", async () => {
      // Arrange
      ctx.query.genre = "RAC"; // Must be one of the MusicGenre enum
      const mockAlbums = [
        {
          _id: "10",
          title: "Genre Album",
          artist: ["Genre Artist"],
          songs: [
            {
              title: "Genre Song",
              file: "genre.mp3",
            },
          ],
          cover: "genre-cover.jpg",
          coverAvif: "genre-cover.avif",
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ];
      albumServiceMock.getAlbumsByGenre.mockImplementation(() =>
        Promise.resolve(mockAlbums as IAlbum[])
      );

      // Act
      await albumController.getAlbumsByGenre(ctx);

      // Assert
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: mockAlbums });
    });

    it("should handle errors and return 500", async () => {
      // Arrange
      ctx.query.genre = "RAC";
      albumServiceMock.getAlbumsByGenre.mockImplementation(() =>
        Promise.reject(new Error("Error"))
      );

      // Act
      await albumController.getAlbumsByGenre(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({ error: "Internal Server Error" });
    });
  });
});
