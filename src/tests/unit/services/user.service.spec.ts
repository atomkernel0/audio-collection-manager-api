/**
 * @file user.service.spec.ts
 * @description Unit tests for UserService. Mocks dependencies like database models and external APIs.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
  spyOn,
} from "bun:test";
import * as utils from "@/utils";
import bcrypt from "bcrypt";

import axios from "axios";
import { UserService } from "@/services/user.service";
import { UserModel } from "@/models/user.model";
import { AlbumModel } from "@/models/album.model";
import ListenedAlbumModel from "@/models/listenedAlbumModel";
import FavoriteAlbumModel from "@/models/favoriteAlbumModel";
import { ApiErrors } from "@/interfaces/api-errors.interface";
import ListenedSongModel from "@/models/listenedSongModel";
import {
  IUser,
  ListenedAlbumStats,
  ListenedSongStats,
} from "@/interfaces/user.interface";
import { Types } from "mongoose";

/**
 * This function is to illustrate how you'd mock your data queries and external calls.
 * We'll mock them globally here, but you can also do finer-grained mocks if you prefer.
 */
describe("UserService", () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();

    // Mock token verification
    spyOn(utils, "verifyToken").mockReturnValue({
      userId: "56cb91bdc3464f14678934ca",
      username: "testuser",
    });

    // Mock UserModel methods
    const mockUser = {
      _id: {
        getTimestamp: () => new Date(),
      },
      username: "testuser",
      listenedSongs: [],
      favoritePlaylist: { songs: ["song1"] },
      save: jest.fn().mockResolvedValue(true),
    };

    spyOn(UserModel, "findById").mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockUser),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
    } as any);

    // Mock AlbumModel methods
    const mockAlbum = {
      _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
      title: "Test Album",
      cover: "cover.jpg",
      artist: ["Artist"],
      lang: "EN",
    };

    spyOn(AlbumModel, "findById").mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockAlbum),
      lean: jest.fn().mockReturnThis(),
    } as any);

    // Mock ListenedAlbumModel methods
    spyOn(ListenedAlbumModel, "find").mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    spyOn(ListenedAlbumModel, "findOne").mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    } as any);

    spyOn(ListenedAlbumModel, "deleteMany").mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    } as any);

    // Mock FavoriteAlbumModel methods
    spyOn(FavoriteAlbumModel, "find").mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    } as any);

    spyOn(FavoriteAlbumModel, "findOne").mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    } as any);

    // Mock aggregate
    spyOn(AlbumModel, "aggregate").mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
          title: "Test Album",
          cover: "cover.jpg",
          artist: ["Artist"],
          lang: "EN",
          songLength: 10,
        },
      ]),
    } as any);
  });

  // Fix listenSong test
  it("should increment song and album play count", async () => {
    const mockUser = {
      _id: "56cb91bdc3464f14678934ca",
      listenedSongs: [],
      save: jest.fn().mockResolvedValue(true),
    };

    spyOn(UserModel, "findById").mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockUser),
      populate: jest.fn().mockReturnThis(),
    } as any);

    const result = await userService.listenSong(
      "token",
      "testTitle",
      "testFile.mp3",
      "6348acd2e1a47ca32e79f46f"
    );

    expect(result.status).toBe(201);
    expect(mockUser.save).toHaveBeenCalled();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * registerUser method
   */
  describe("registerUser", () => {
    beforeEach(() => {
      // Mock axios for hCaptcha verification
      spyOn(axios, "post").mockResolvedValue({
        data: {
          success: true,
        },
      });

      // Mock token creation
      spyOn(utils, "createToken").mockReturnValue("mocked-jwt-token");
    });

    it("should register a new user if username is available and captcha is valid", async () => {
      // Arrange
      spyOn(utils, "checkUser").mockResolvedValue({
        success: false,
        data: null,
      });

      spyOn(utils, "createUser").mockResolvedValue({
        success: true,
        data: {
          _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
          username: "newuser",
        } as IUser,
      });

      // Act
      const result = await userService.registerUser(
        "newuser",
        "somepassword",
        "hcaptchaResponse",
        false,
        undefined
      );

      // Assert
      expect(result.status).toBe(201);
      expect(result.body).toEqual({
        message: "User registered successfully",
        token: "mocked-jwt-token",
      });
      expect(axios.post).toHaveBeenCalledWith(
        "https://hcaptcha.com/siteverify",
        expect.anything()
      );
    });

    it("should throw username taken error if user already exists", async () => {
      // Arrange
      spyOn(utils, "checkUser").mockResolvedValue({
        success: true,
        data: {
          _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
          username: "existingUsername",
        } as IUser,
      });

      // Act & Assert
      expect(
        userService.registerUser(
          "existingUsername",
          "pass",
          "resp",
          false,
          undefined
        )
      ).rejects.toEqual(ApiErrors.USERNAME_TAKEN);
    });

    it("should throw error if captcha is invalid", async () => {
      // Arrange
      spyOn(axios, "post").mockResolvedValue({ data: { success: false } });
      spyOn(utils, "checkUser").mockResolvedValue({
        success: false,
        data: null,
      });

      // Act & Assert
      expect(
        userService.registerUser(
          "user",
          "pass",
          "invalid_captcha",
          false,
          undefined
        )
      ).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
        message: "Error during captcha verification",
        status: 500,
      });
    });
  });

  /**
   * loginUser method
   */
  describe("loginUser", () => {
    it("should log in successfully with correct credentials", async () => {
      // Arrange
      spyOn(utils, "checkUser").mockResolvedValue({
        success: true,
        data: {
          _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
          password: "$2b$10$someHashedPassword",
          username: "testuser",
        } as IUser,
      });
      spyOn(utils, "createToken").mockReturnValue("jwt-token");
      spyOn(utils, "verifyToken").mockReturnValue({
        userId: "56cb91bdc3464f14678934ca",
        username: "testuser",
      });

      spyOn(bcrypt, "compare").mockImplementation(() => Promise.resolve(true));

      // Act
      const result = await userService.loginUser("testuser", "correctPass");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Login successful.");
      expect(result.body.token).toBe("jwt-token");
    });

    it("should fail with invalid credentials", async () => {
      // Arrange
      spyOn(utils, "checkUser").mockResolvedValue({
        success: false,
        data: {
          _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
          password: "invalid",
          username: "testuser",
        } as IUser,
      });

      // Act / Assert
      expect(userService.loginUser("unknownUser", "somePass")).rejects.toEqual(
        ApiErrors.INVALID_CREDENTIALS
      );
    });
  });

  /**
   * getUserInfo method
   */
  describe("getUserInfo", () => {
    it("should return user info if token is valid", async () => {
      // Arrange
      const mockUser = {
        _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
        username: "testuser",
        listenedSongs: [{ playCount: 5 }],
        favoritePlaylist: { songs: ["favSong"] },
        playlists: [{}, {}],
      };
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserInfo("some-valid-token");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.user.username).toBe("testuser");
      expect(result.body.user.totalPlays).toBe(5);
      expect(result.body.user.favoriteCount).toBe(1);
      expect(result.body.user.playlistsCount).toBe(2);
    });

    it("should throw if user not found", async () => {
      // Arrange
      (UserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act / Assert
      expect(userService.getUserInfo("some-valid-token")).rejects.toEqual(
        ApiErrors.USER_NOT_FOUND
      );
    });
  });

  /**
   * listenSong method
   */
  describe("listenSong", () => {
    it("should increment song and album play count", async () => {
      // Create a proper mock user with initialized arrays
      const mockUser = {
        _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
        username: "testuser",
        listenedSongs: [{ title: "title", file: "file" }], // Initialize as empty array
        listenedAlbums: [], // Initialize as empty array
        save: jest.fn().mockResolvedValue(true),
      };

      // Mock UserModel.findById
      spyOn(UserModel, "findById").mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
        populate: jest.fn().mockReturnThis(),
      } as any);

      // Mock AlbumModel.findById
      spyOn(AlbumModel, "findById").mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
          title: "Test Album",
        }),
      } as any);

      // Act
      const result = await userService.listenSong(
        "token",
        "testTitle",
        "testFile.mp3",
        "6348acd2e1a47ca32e79f46f"
      );

      // Assert
      expect(result.status).toBe(201);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("should throw if user not found", async () => {
      // Mock UserModel.findById to return null
      spyOn(UserModel, "findById").mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
        populate: jest.fn().mockReturnThis(),
      } as any);

      // Act & Assert
      expect(
        userService.listenSong("token", "title", "file", "album123")
      ).rejects.toEqual({
        code: "USER_NOT_FOUND",
        message: "Utilisateur non trouvé",
        status: 404,
      });
    });
  });

  /**
   * getUserListeningStats method
   */
  describe("getUserListeningStats", () => {
    it("should return listenedSongs and listenedAlbums if user found", async () => {
      // Arrange
      const mockUser: {
        listenedSongs: ListenedSongStats[];
        listenedAlbums: ListenedAlbumStats[];
      } = {
        listenedSongs: [
          {
            songTitle: "song1",
            songFile: "path/song1",
            albumId: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
            playCount: 1,
            listenHistory: [],
          },
        ],
        listenedAlbums: [
          {
            albumId: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
            playCount: 1,
            listenHistory: [],
          },
        ],
      };
      (UserModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser),
        }),
      });

      // Act
      const result = await userService.getUserListeningStats("token");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.listenedSongs).toEqual([
        {
          songTitle: "song1",
          songFile: "path/song1",
          albumId: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
          playCount: 1,
          listenHistory: [],
        },
        ,
      ]);
      expect(result.body.listenedAlbums).toEqual([
        {
          albumId: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
          playCount: 1,
          listenHistory: [],
        },
      ]);
    });

    it("should throw if user not found", async () => {
      // Arrange
      (UserModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(null),
        }),
      });

      // Act / Assert
      expect(userService.getUserListeningStats("token")).rejects.toEqual(
        ApiErrors.USER_NOT_FOUND
      );
    });
  });

  /**
   * getListenedSongs method
   */
  describe("getListenedSongs", () => {
    it("should return last 30 sorted songs", async () => {
      // Arrange
      const mockSong = {
        songTitle: "mockSong",
        songFile: "file.mp3",
        albumId: "6348acd2e1a47ca32e79f46f",
        playCount: 2,
        listenHistory: [new Date()],
      };
      const mockUser: any = {
        listenedSongs: [mockSong, mockSong],
      };
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);
      (AlbumModel.findById as jest.Mock).mockResolvedValue({
        cover: "cover.png",
        title: "albumTitle",
        artist: ["testArtist"],
        lang: "EN",
        songs: [],
        _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
      });

      // Act
      const result = await userService.getListenedSongs("validToken");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.listenedSongs.length).toBe(2);
      expect(result.body.listenedSongs[1].albumTitle).toBe("albumTitle");
    });
  });

  /**
   * listenAlbum method
   */
  describe("listenAlbum", () => {
    it("should save album to listened albums if not already exists", async () => {
      // Arrange
      (AlbumModel.findById as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
        title: "Test Album",
      });
      (ListenedAlbumModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.listenAlbum("token", "album123");

      // Assert
      expect(result.status).toBe(201);
      expect(result.body.message).toBe("Album listened successfully");
    });

    it("should update listenedAt if album already listened", async () => {
      // Arrange
      const mockAlbumDoc: any = { listenedAt: null, save: jest.fn() };
      (AlbumModel.findById as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
      });
      (ListenedAlbumModel.findOne as jest.Mock).mockResolvedValue(mockAlbumDoc);

      // Act
      const result = await userService.listenAlbum("token", "album123");

      // Assert
      expect(result.status).toBe(201);
      expect(mockAlbumDoc.save).toHaveBeenCalled();
    });
  });

  /**
   * getListenedAlbums method
   */
  describe("getListenedAlbums", () => {
    it("should return last 15 listened albums with formatted data", async () => {
      // Arrange
      const mockAlbum = {
        _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
        title: "TestAlbum",
        artist: ["TestArtist"],
        cover: "cover.png",
        songs: [{}, {}],
        lang: "EN",
      };
      (ListenedAlbumModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest
          .fn()
          .mockResolvedValue([
            { album: { ...mockAlbum } },
            { album: { ...mockAlbum } },
          ]),
      });

      // Act
      const result = await userService.getListenedAlbums("token");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.albums.length).toBe(2);
      expect(result.body.albums[1].title).toBe("TestAlbum");
    });
  });

  /**
   * changeUsername method
   */
  describe("changeUsername", () => {
    it("should update username if not already taken", async () => {
      // Arrange
      (UserModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        _id: "56cb91bdc3464f14678934ca",
        username: "newUser",
      });

      // Act
      const result = await userService.changeUsername("token", "newUser");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.newUsername).toBe("newUser");
    });

    it("should throw CONFLICT if username is taken", async () => {
      // Arrange
      (UserModel.findOne as jest.Mock).mockResolvedValue({ username: "taken" });

      // Act / Assert
      expect(
        userService.changeUsername("token", "taken")
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  /**
   * changePassword method
   */
  describe("changePassword", () => {
    it("should update password if current password is correct", async () => {
      // Arrange
      const mockUser: any = {
        _id: "56cb91bdc3464f14678934ca",
        password: "hashedOldPass",
        save: jest.fn(),
      };
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      spyOn(bcrypt, "compare").mockImplementation(() => Promise.resolve(true));
      spyOn(bcrypt, "hash").mockImplementation(() =>
        Promise.resolve("hashedNewPass")
      );

      // Act
      const result = await userService.changePassword(
        "token",
        "OldPass123",
        "NewPass!234"
      );

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Password updated successfully");
      expect(mockUser.password).toBe("hashedNewPass");
    });

    it("should throw if current password is incorrect", async () => {
      // Arrange
      const mockUser: any = {
        _id: "56cb91bdc3464f14678934ca",
        password: "hashedOldPass",
      };
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);
      spyOn(bcrypt, "compare").mockImplementation(() => Promise.resolve(false));

      // Act / Assert
      expect(
        userService.changePassword("token", "WrongPass", "NewPass")
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    });
  });

  /**
   * deleteAccount method
   */
  describe("deleteAccount", () => {
    it("should delete user account and related data", async () => {
      // Arrange
      (UserModel.findByIdAndDelete as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
      });

      // Act
      const result = await userService.deleteAccount("token");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Account deleted successfully");
      expect(ListenedAlbumModel.deleteMany).toHaveBeenCalledWith({
        _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
      });
      expect(ListenedSongModel.deleteMany).toHaveBeenCalledWith({
        _id: new Types.ObjectId("56cb91bdc3464f14678934ca"),
      });
    });
  });

  /**
   * addFavoriteAlbum & removeFavoriteAlbum
   */
  describe("addFavoriteAlbum", () => {
    it("should add album to favorites if not already there", async () => {
      // Arrange
      (AlbumModel.findOne as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
      });

      // Act
      const result = await userService.addFavoriteAlbum("token", "album123");

      // Assert
      expect(result.status).toBe(201);
      expect(result.body.message).toBe("Album added to favorites");
    });

    it("should throw conflict if album is already in favorites", async () => {
      // Arrange
      (AlbumModel.findOne as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
      });
      (FavoriteAlbumModel.findOne as jest.Mock).mockResolvedValue({
        albumId: "6348acd2e1a47ca32e79f46f",
      });

      // Act / Assert
      expect(
        userService.addFavoriteAlbum("token", "album123")
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  describe("removeFavoriteAlbum", () => {
    it("should remove album from favorites", async () => {
      // Arrange
      (FavoriteAlbumModel.findOneAndDelete as unknown) = jest
        .fn()
        .mockResolvedValue({ albumId: "6348acd2e1a47ca32e79f46f" });

      // Act
      const result = await userService.removeFavoriteAlbum(
        "token",
        "6348acd2e1a47ca32e79f46f"
      );

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.message).toBe("Album removed from favorites");
    });

    it("should throw NOT_FOUND if album is not in favorites", async () => {
      // Arrange
      (FavoriteAlbumModel.findOneAndDelete as jest.Mock).mockResolvedValue(
        null
      );

      // Act / Assert
      expect(
        userService.removeFavoriteAlbum("token", "albumNotExists")
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  /**
   * getFavoriteAlbums
   */
  describe("getFavoriteAlbums", () => {
    it("should return a sorted list of favorite albums", async () => {
      // Arrange
      (FavoriteAlbumModel.find as jest.Mock).mockResolvedValue([
        { albumId: "6348acd2e1a47ca32e79f46f" },
        { albumId: "6348acd2e1a47ca32e79f47f" },
      ]);
      (AlbumModel.aggregate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId("6348acd2e1a47ca32e79f46f"),
            title: "Z_Album",
            cover: "cover1.png",
            artist: ["Artist1"],
            lang: "EN",
            songLength: 10,
          },
          {
            _id: new Types.ObjectId("6348acd2e1a47ca32e79f47f"),
            title: "A_Album",
            cover: "cover2.png",
            artist: ["Artist2"],
            lang: "FR",
            songLength: 8,
          },
        ]),
      });

      // Act
      const result = await userService.getFavoriteAlbums("token");

      // Assert
      expect(result.status).toBe(200);
      const albums = result.body.albums;
      // They should be sorted: A_Album then Z_Album
      expect(albums[1].title).toBe("A_Album");
      expect(albums[2].title).toBe("Z_Album");
    });

    it("should return an empty array if no favorites", async () => {
      // Arrange
      spyOn(FavoriteAlbumModel, "find").mockImplementation([]);

      // Act
      const result = await userService.getFavoriteAlbums("token");

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.albums.length).toBe(0);
    });
  });

  /**
   * checkIfAlbumIsFavorite
   */
  describe("checkIfAlbumIsFavorite", () => {
    it("should confirm if album is favorite", async () => {
      // Arrange
      (FavoriteAlbumModel.findOne as jest.Mock).mockResolvedValue({
        albumId: "6348acd2e1a47ca32e79f46f",
      });

      // Act
      const result = await userService.checkIfAlbumIsFavorite(
        "token",
        "6348acd2e1a47ca32e79f46f"
      );

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.isFavorite).toBe(true);
    });

    it("should confirm if album is not favorite", async () => {
      // Arrange
      (FavoriteAlbumModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await userService.checkIfAlbumIsFavorite(
        "token",
        "6348acd2e1a47ca32e79f46f"
      );

      // Assert
      expect(result.status).toBe(200);
      expect(result.body.isFavorite).toBe(false);
    });

    it("should throw if albumId is invalid or missing", async () => {
      // Act & Assert
      expect(userService.checkIfAlbumIsFavorite("token")).rejects.toMatchObject(
        {
          code: "INVALID_INPUT",
        }
      );
    });
  });
});
