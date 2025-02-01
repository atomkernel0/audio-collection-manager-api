/**
 * @file album.service.spec.ts
 * @description Unit tests for AlbumService using Bun test and TypeScript.
 */

import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";

import { MusicGenre, type IAlbum } from "@/interfaces/album.interface";
import { AlbumService } from "@/services/album.service";
import mongoose from "mongoose";
import { fail } from "assert";
import { logger } from "@/index";

const mockConnection = {
  readyState: 1,
  on: mock(() => {}),
  once: mock(() => {}),
  emit: mock(() => {}),
};

const createMockAlbumModel = () => ({
  aggregate: mock(() => Promise.resolve([])),
  findOne: mock(() => ({
    lean: () => ({
      exec: () => Promise.resolve(null),
    }),
  })),
  find: mock(() => ({
    lean: () => ({
      exec: () => Promise.resolve([]),
    }),
    select: () => ({
      limit: () => ({
        lean: () => ({
          exec: () => Promise.resolve([]),
        }),
      }),
    }),
  })),
});

const mockedAlbumModel = createMockAlbumModel();

mock.module("mongoose", () => ({
  ...mongoose,
  createConnection: mock(() => mockConnection),
  connect: mock(() => Promise.resolve(mockConnection)),
  connection: mockConnection,
  set: mock(() => mongoose),
  model: mock(() => mockedAlbumModel),
}));

mock.module("@/models/album.model", () => ({
  AlbumModel: mockedAlbumModel,
}));

mock.module("../../models/album.model", () => ({
  AlbumModel: mockedAlbumModel,
}));

describe("AlbumService (unit tests)", () => {
  let albumService: AlbumService;

  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Disable logger
    logger.level = "silent";

    // Create fresh instances
    albumService = new AlbumService();

    // Setup default mock responses
    mockedAlbumModel.aggregate.mockImplementation(() => Promise.resolve([]));

    mockedAlbumModel.find.mockImplementation(() => ({
      lean: () => ({
        exec: () => Promise.resolve([]),
      }),
      select: () => ({
        limit: () => ({
          lean: () => ({
            exec: () => Promise.resolve([]),
          }),
        }),
        lean: () => ({
          exec: () => Promise.resolve([]),
        }),
      }),
    }));

    mockedAlbumModel.findOne.mockImplementation(() => ({
      lean: () => ({
        exec: () => Promise.resolve(null),
      }),
    }));
  });

  afterEach(() => {
    // Reset all mocks
    mock.restore();
  });

  /**
   * @test Suite for getAllAlbums()
   */
  describe("getAllAlbums()", () => {
    it("should query database and return formatted albums when cache is empty", async () => {
      // Arrange
      mockedAlbumModel.aggregate.mockImplementation(() =>
        Promise.resolve([
          {
            _id: "1",
            title: "Test Album",
            artist: ["Test Artist"],
            songs: [],
            cover: `${process.env.CDN_URL}/cover.jpg`,
            coverAvif: `${process.env.CDN_URL}/cover.avif`,
            lang: "fr",
            genre: [MusicGenre.RAC],
          },
        ] as IAlbum[])
      );

      // Act
      const result = await albumService.getAllAlbums();

      // Assert
      expect(mockedAlbumModel.aggregate).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          _id: "1",
          title: "Test Album",
          artist: ["Test Artist"],
          songs: [],
          cover: `${process.env.CDN_URL}/cover.jpg`,
          coverAvif: `${process.env.CDN_URL}/cover.avif`,
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ] as IAlbum[]);
    });
  });

  /**
   * @test Suite for getAlbumsByOrder()
   */
  describe("getAlbumsByOrder()", () => {
    describe("getAlbumsByOrder()", () => {
      it("should retrieve albums, format and sort them, then paginate", async () => {
        // Clear all mocks before the test
        mockedAlbumModel.aggregate.mockClear();

        // Arrange
        mockedAlbumModel.aggregate.mockImplementation(() =>
          Promise.resolve([
            { _id: "a2", title: "Z Title", cover: "img2.jpg" },
            { _id: "a1", title: "A Title", cover: "img1.jpg" },
          ] as IAlbum[])
        );

        // Act
        const result = await albumService.getAlbumsByOrder(1, 50);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe("A Title");
        expect(result[1].title).toBe("Z Title");
        expect(result[0].cover).toBe(`${process.env.CDN_URL}/img1.jpg`);
        expect(result[0].coverAvif).toBe(`${process.env.CDN_URL}/img1.avif`);
        expect(mockedAlbumModel.aggregate).toHaveBeenCalledTimes(1);
      });
    });
  });

  /**
   * @test Suite for getAlbumById()
   */
  describe("getAlbumById()", () => {
    it("should return null if album not found", async () => {
      // Arrange
      mockedAlbumModel.findOne.mockImplementation(() => ({
        lean: () => ({
          exec: () => Promise.resolve(null),
        }),
      }));

      // Act
      const result = await albumService.getAlbumById("non-existent");

      // Assert
      expect(result).toBeNull();
    });

    it("should return the album with formatted covers if found", async () => {
      // Arrange
      const mockAlbum = {
        _id: "2",
        cover: "mock.jpg",
        title: "Test Album",
        artist: ["Test Artist"],
        songs: [],
        lang: "fr",
        genre: [MusicGenre.RAC],
      } as IAlbum;

      mockedAlbumModel.findOne.mockImplementation(() => ({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: "2",
              cover: "mock.jpg",
              title: "Test Album",
              artist: ["Test Artist"],
              songs: [],
              lang: "fr",
              genre: [MusicGenre.RAC],
            }),
        }),
      }));

      // Act
      const result = await albumService.getAlbumById("2");

      // Assert
      expect(result).not.toBeNull();
      expect(result?._id).toBe("2");
      expect(result?.cover).toBe(`${process.env.CDN_URL}/mock.jpg`);
      expect(result?.coverAvif).toBe(`${process.env.CDN_URL}/mock.avif`);
    });
  });

  /**
   * @test Suite for searchAlbums()
   */
  describe("searchAlbums()", () => {
    it("should return matching albums using Fuse.js search", async () => {
      // Arrange
      mockedAlbumModel.aggregate.mockImplementation(() =>
        Promise.resolve([
          {
            _id: "1",
            title: "My Rock Album",
            artist: ["Metal"],
            cover: "rock.jpg",
            songs: [],
            lang: "en",
            genre: [MusicGenre.RAC],
          },
          {
            _id: "2",
            title: "Pop Hits",
            artist: ["PopArtist"],
            cover: "pop.jpg",
            songs: [],
            lang: "en",
            genre: [MusicGenre.RAC],
          },
        ] as IAlbum[])
      );

      // Act
      const results = await albumService.searchAlbums("Rock");

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe("1");
      expect(results[0].cover).toBe(`${process.env.CDN_URL}/rock.jpg`);
      expect(results[0].coverAvif).toBe(`${process.env.CDN_URL}/rock.avif`);
    });
  });

  /**
   * @test Suite for getArtists()
   */
  describe("getArtists()", () => {
    it("should return a sorted list of unique artists info", async () => {
      // Arrange
      mockedAlbumModel.find.mockImplementation(() => ({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              {
                _id: "a1",
                cover: "c1.jpg",
                artist: ["ArtistA"],
                songs: [{}, {}],
                title: "Album 1",
                lang: "fr",
                genre: [MusicGenre.RAC],
              },
              {
                _id: "a2",
                cover: "c2.jpg",
                artist: ["ArtistB"],
                songs: [{}],
                title: "Album 2",
                lang: "fr",
                genre: [MusicGenre.RAC],
              },
              {
                _id: "a3",
                cover: "c3.jpg",
                artist: ["ArtistA"],
                songs: [{}],
                title: "Album 3",
                lang: "fr",
                genre: [MusicGenre.RAC],
              },
            ] as IAlbum[]),
        }),
        select: () => ({
          limit: () => ({
            lean: () => ({
              exec: () =>
                Promise.resolve([
                  {
                    _id: "a1",
                    cover: "c1.jpg",
                    artist: ["ArtistA"],
                    songs: [{}, {}],
                    title: "Album 1",
                    lang: "fr",
                    genre: [MusicGenre.RAC],
                  },
                  // ... autres albums si nécessaire
                ] as IAlbum[]),
            }),
          }),
        }),
      }));

      // Act
      const artists = await albumService.getArtists();

      // Assert
      expect(artists).toHaveLength(2);
      expect(artists[0].name).toBe("ArtistA");
      expect(artists[0].totalSongs).toBe(3);
      expect(artists[0].totalAlbums).toBe(2);
      expect(artists[1].name).toBe("ArtistB");
    });
  });

  /**
   * @test Suite for getMostListenedAlbums()
   */
  describe("getMostListenedAlbums()", () => {
    it("should return empty array if no listened data found", async () => {
      // Arrange
      mockedAlbumModel.aggregate.mockImplementation(() => Promise.resolve([]));

      // Act
      const results = await albumService.getMostListenedAlbums();

      // Assert
      expect(results).toEqual([]);
    });

    it("should return the sorted albums when data exists", async () => {
      mockedAlbumModel.aggregate.mockImplementation(() =>
        Promise.resolve([
          {
            _id: "1",
            title: "AlbumX",
            cover: "x.jpg",
            artist: ["Artist X"],
            songs: [
              {
                title: "title",
                file: "path",
              },
            ],
            lang: "fr",
            genre: [MusicGenre.RAC],
          },
          {
            _id: "2",
            title: "AlbumY",
            cover: "y.jpg",
            artist: ["Artist Y"],
            songs: [
              {
                title: "title 2",
                file: "path 2",
              },
            ],
            lang: "fr",
            genre: [MusicGenre.RAC],
          },
        ] as IAlbum[])
      );

      // Act
      const results = await albumService.getMostListenedAlbums();

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0]._id).toBe("1");
      expect(results[0].cover).toBe(`${process.env.CDN_URL}/x.jpg`);
      expect(results[0].coverAvif).toBe(`${process.env.CDN_URL}/x.avif`);
    });
  });

  /**
   * @test Suite for getPrimaryColor()
   */
  describe("getPrimaryColor()", () => {
    it("should throw error if URL not from CDN url", async () => {
      // Arrange
      const invalidURL = "https://some-other-site.com/cover.jpg";

      // Act & Assert
      expect(albumService.getPrimaryColor(invalidURL)).rejects.toThrow(
        `Invalid URL: Only images from ${process.env.CDN_URL} are allowed`
      );
    });
  });

  /**
   * @test Suite for getRandomAlbums()
   */
  describe("getRandomAlbums()", () => {
    it("should return random albums with formatted covers", async () => {
      // Arrange
      const mockAlbums = [
        {
          _id: "r1",
          title: "Rand1",
          cover: "r1.jpg",
          songs: [{}],
          artist: ["Random Artist"],
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
        {
          _id: "r2",
          title: "Rand2",
          cover: "r2.jpg",
          songs: [],
          artist: ["Random Artist 2"],
          lang: "fr",
          genre: [MusicGenre.RAC],
        },
      ] as IAlbum[];

      mockedAlbumModel.aggregate.mockImplementation(() =>
        Promise.resolve(mockAlbums)
      );

      // Act
      const results = await albumService.getRandomAlbums();

      // Assert
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.cover)).toEqual([
        `${process.env.CDN_URL}/r1.jpg`,
        `${process.env.CDN_URL}/r2.jpg`,
      ]);
    });
  });

  /**
   * @test Suite for searchSongs()
   */
  describe("searchSongs()", () => {
    it("should return matching songs with album info", async () => {
      // Arrange
      const mockAlbums = [
        {
          _id: "a10",
          title: "Album10",
          artist: ["Ar1"],
          cover: "c10.jpg",
          lang: "EN",
          songs: [
            { title: "TestSong", file: "testsong.mp3" },
            { title: "AnotherSong", file: "another.mp3" },
          ],
          genre: [MusicGenre.RAC],
        },
      ] as IAlbum[];

      mockedAlbumModel.find.mockImplementation(() => ({
        lean: () => ({
          exec: () => Promise.resolve(mockAlbums),
        }),
        select: () => ({
          limit: () => ({
            lean: () => ({
              exec: () => Promise.resolve(mockAlbums),
            }),
          }),
        }),
      }));

      // Act
      const songs = await albumService.searchSongs("TestSong");

      // Assert
      expect(songs).toHaveLength(1);
      expect(songs[0].title).toBe("TestSong");
    });
  });

  /**
   * @test Suite for getAlbumsByArtist()
   */
  describe("getAlbumsByArtist()", () => {
    it("should return albums, random songs, and total songs for the artist", async () => {
      // Arrange
      const mockAlbums = [
        {
          _id: "ab1",
          title: "ArtistAlbum1",
          cover: "cover1.jpg",
          artist: ["testartist"],
          lang: "EN",
          songs: [{ title: "s1" }, { title: "s2" }],
          genre: [MusicGenre.RAC],
        },
      ] as IAlbum[];

      // Premier mock pour find() avec toutes les méthodes chaînées possibles
      const findMock = {
        select: () => ({
          limit: () => ({
            lean: () => ({
              exec: () => Promise.resolve(mockAlbums),
            }),
          }),
          lean: () => ({
            exec: () => Promise.resolve(mockAlbums),
          }),
        }),
        lean: () => ({
          exec: () => Promise.resolve(mockAlbums),
        }),
        limit: () => ({
          lean: () => ({
            exec: () => Promise.resolve(mockAlbums),
          }),
        }),
      };

      mockedAlbumModel.find.mockImplementation(() => findMock);

      // Act
      const result = await albumService.getAlbumsByArtist("testartist");

      // Assert
      expect(result.albums).toHaveLength(1);
      expect(result.albums[0].title).toBe("ArtistAlbum1");
      expect(result.totalSongs).toBe(2);
      expect(result.randomSongs).toBeDefined();
    });
  });

  /**
   * @test Suite for getAlbumsByGenre()
   */
  describe("getAlbumsByGenre()", () => {
    it("should return sorted & formatted albums for a valid genre", async () => {
      // Arrange
      mockedAlbumModel.aggregate.mockImplementation(() =>
        Promise.resolve([
          {
            _id: "g1",
            title: "Z Album",
            cover: "z.jpg",
            artist: ["Artist Z"],
            songs: [],
            lang: "fr",
            genre: [MusicGenre.RAC],
          },
          {
            _id: "g2",
            title: "A Album",
            cover: "a.jpg",
            artist: ["Artist A"],
            songs: [],
            lang: "fr",
            genre: [MusicGenre.RAC],
          },
        ] as IAlbum[])
      );

      // Act
      const results = await albumService.getAlbumsByGenre(MusicGenre.RAC);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("A Album"); // sorted
      expect(results[1].title).toBe("Z Album");
      expect(results[0].coverAvif).toBe(`${process.env.CDN_URL}/a.avif`);
      expect(results[1].coverAvif).toBe(`${process.env.CDN_URL}/z.avif`);
    });

    it("should handle empty results", async () => {
      // Arrange
      mockedAlbumModel.aggregate.mockImplementation(() => Promise.resolve([]));

      // Act
      const results = await albumService.getAlbumsByGenre(MusicGenre.RAC);

      // Assert
      expect(results).toHaveLength(0);
    });

    it("should handle errors", async () => {
      // Arrange
      mockedAlbumModel.aggregate.mockImplementation(() =>
        Promise.reject(new Error("Database error"))
      );

      // Act & Assert
      try {
        await albumService.getAlbumsByGenre(MusicGenre.RAC);
        fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).toBe("Database error");
      }
    });
  });
});
