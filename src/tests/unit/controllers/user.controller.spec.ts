/**
 * @file user.controller.spec.ts
 * @description Unit tests for UserController, using Bun's test runner (Jest-like syntax).
 *             This covers success scenarios, error handling, and edge cases.
 */

import { UserController } from "@/controllers/user.controller";
import { ApiError, ApiErrors } from "@/interfaces/api-errors.interface";
import { UserService } from "@/services/user.service";
import { createMockContext, MockRequest } from "@/tests/utils/mock-context";
import { describe, it, beforeEach, afterEach, expect, jest } from "bun:test";

/**
 * Mocks & Setup
 */
describe("UserController", () => {
  let mockUserService: UserService;
  let userController: UserController;

  beforeEach(() => {
    // Create a mocked UserService with Jest spy references
    mockUserService = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      getUserInfo: jest.fn(),
      listenSong: jest.fn(),
      getUserListeningStats: jest.fn(),
      getListenedSongs: jest.fn(),
      listenAlbum: jest.fn(),
      getListenedAlbums: jest.fn(),
      changeUsername: jest.fn(),
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      addFavoriteAlbum: jest.fn(),
      removeFavoriteAlbum: jest.fn(),
      getFavoriteAlbums: jest.fn(),
      checkIfAlbumIsFavorite: jest.fn(),
      validateTokenOrThrow: jest.fn(),
    } as unknown as UserService;

    userController = new UserController(mockUserService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Test Suite: registerUser
   */
  describe("registerUser", () => {
    it("should register a new user successfully", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/register",
          header: {},
          body: {
            username: "testuser",
            password: "Validpassword1!",
            hcaptchaResponse: "fake_captcha_token",
          },
        } as MockRequest,
        headers: {
          authorization: "Bearer token",
        },
        set: jest.fn(),
      });

      (mockUserService.registerUser as jest.Mock).mockResolvedValue({
        status: 201,
        body: { message: "User registered successfully", token: "fake_token" },
        newAuthToken: "fake_token",
      });

      // Act
      await userController.registerUser(ctx);

      // Assert
      expect(ctx.status).toBe(201);
      expect(ctx.body).toEqual({
        message: "User registered successfully",
        token: "fake_token",
      });
      // Ensure the controller sets ctx["isUserAuthenticated"] = true
      expect(ctx["isUserAuthenticated"]).toBe(true);
    });

    it("should return 400 on validation error (missing fields)", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/login",
          header: {},
          body: {
            username: "",
            password: "",
          },
        } as MockRequest,
      });

      // Act
      await userController.registerUser(ctx);

      // Assert
      expect(ctx.status).toBe(400);
      expect(ctx.body).toHaveProperty("error");
      expect(ctx.body).toHaveProperty("code");
    });

    it("should handle service layer errors correctly", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/login",
          headers: {
            authorization: "Bearer token",
          },
          body: {
            username: "testuser",
            password: "Validpassword1!",
            hcaptchaResponse: "fake_captcha_token",
          },
        } as MockRequest,
        headers: {
          authorization: "Bearer token",
        },
      });

      const thrownError = { ...ApiErrors.INTERNAL_ERROR, message: "DB down" };
      (mockUserService.registerUser as jest.Mock).mockRejectedValue(
        thrownError
      );

      // Act
      await userController.registerUser(ctx);

      // Assert
      expect(ctx.status).toBe(500);
      expect(ctx.body).toEqual({
        error: "DB down",
        code: "INTERNAL_ERROR",
      });
    });
  });

  /**
   * Test Suite: loginUser
   */
  describe("loginUser", () => {
    it("should log in a user successfully", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/login",
          headers: {
            authorization: "Bearer token",
          },
          body: {
            username: "testuser",
            password: "Validpassword1!",
          },
        } as MockRequest,
        set: jest.fn(),
      });

      (mockUserService.loginUser as jest.Mock).mockResolvedValue({
        status: 200,
        body: { message: "Login successful.", token: "fake_token" },
        newAuthToken: "fake_token",
      });

      // Act
      await userController.loginUser(ctx as any);

      // Assert
      expect(mockUserService.loginUser).toHaveBeenCalledWith(
        "testuser",
        "Validpassword1!"
      );

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        message: "Login successful.",
        token: "fake_token",
      });
      expect(ctx["isUserAuthenticated"]).toBe(true);
    });

    it("should return 400 if validation fails (missing password)", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/login",
          header: {},
          body: { username: "testuser" },
        } as MockRequest,
      });

      // Act
      await userController.loginUser(ctx);

      // Assert
      expect(ctx.status).toBe(400);
      expect(ctx.body).toHaveProperty("error");
      expect(ctx.body).toHaveProperty("code");
    });

    it("should handle invalid credentials", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/login",
          header: {},
          body: {
            username: "invalid",
            password: "wrong",
          },
        } as MockRequest,
      });

      (mockUserService.loginUser as jest.Mock).mockRejectedValue(
        ApiErrors.INVALID_CREDENTIALS
      );

      // Act
      await userController.loginUser(ctx);

      // Assert
      expect(ctx.status).toBe(401);
      expect(ctx.body).toHaveProperty("error");
      expect(ctx.body).toHaveProperty("code");
      expect((ctx.body as any).error).toBe("Identifiants invalides");
    });
  });

  /**
   * Test Suite: getUserInfo
   */
  describe("getUserInfo", () => {
    it("should get user info successfully if token is valid", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "GET",
          url: "/protected-route",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
        } as MockRequest,
      });

      (mockUserService.getUserInfo as jest.Mock).mockResolvedValue({
        status: 200,
        body: { user: { userId: "123", username: "testuser" } },
      });

      // Act
      await userController.getUserInfo(ctx);

      // Assert
      expect(mockUserService.getUserInfo).toHaveBeenCalledWith("valid_token");
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        user: { userId: "123", username: "testuser" },
      });
    });

    it("should return 401 if no token provided", async () => {
      // Arrange
      const ctx = createMockContext({});

      // Act
      await userController.getUserInfo(ctx);

      // Assert
      expect(ctx.status).toBe(401);
      expect(ctx.body).toHaveProperty("error");
      //   expect(ctx.body.code).toBe("UNAUTHORIZED");
    });
  });

  /**
   * Test Suite: listenSong
   */
  describe("listenSong", () => {
    it("should record listening for a valid song", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/songs",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
          body: {
            songTitle: "testSong",
            songFile: "testSong.mp3",
            albumId: "album123",
          },
        } as MockRequest,
      });

      (mockUserService.listenSong as jest.Mock).mockResolvedValue({
        status: 201,
        body: { message: "Song listened successfully" },
      });

      // Act
      await userController.listenSong(ctx);

      // Assert
      expect(mockUserService.listenSong).toHaveBeenCalledWith(
        "valid_token",
        "testSong",
        "testSong.mp3",
        "album123"
      );
      expect(ctx.status).toBe(201);
      expect(ctx.body).toEqual({ message: "Song listened successfully" });
    });

    describe("listenSong", () => {
      it("should return 401 if token is missing", async () => {
        // Arrange
        const ctx = createMockContext({
          request: {
            method: "POST",
            url: "/songs/listen",
            headers: {
              authorization: "invalid",
            },
            body: {
              songTitle: "testSong",
              songFile: "testSong.mp3",
              albumId: "album123",
            },
          } as MockRequest,
        });

        // Act
        await userController.listenSong(ctx);

        // Assert
        expect(ctx.status).toBe(401);
        expect((ctx.body as { error: string; code: string }).code).toEqual(
          "UNAUTHORIZED"
        );
      });
    });
  });

  /**
   * Test Suite: getUserListeningStats
   */
  describe("getUserListeningStats", () => {
    it("should retrieve the user's listening stats", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "GET",
          url: "/protected-route",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
        } as MockRequest,
      });

      (mockUserService.getUserListeningStats as jest.Mock).mockResolvedValue({
        status: 200,
        body: { listenedSongs: [], listenedAlbums: [] },
      });

      // Act
      await userController.getUserListeningStats(ctx);

      // Assert
      expect(mockUserService.getUserListeningStats).toHaveBeenCalledWith(
        "valid_token"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ listenedSongs: [], listenedAlbums: [] });
    });

    it("should return 401 if token is missing", async () => {
      // Arrange
      const ctx = createMockContext({});

      // Act
      await userController.getUserListeningStats(ctx);

      // Assert
      expect(ctx.status).toBe(401);
      //   expect(ctx.body.code).toBe("UNAUTHORIZED");
    });
  });

  /**
   * Test Suite: getListenedSongs
   */
  describe("getListenedSongs", () => {
    it("should return last 30 listened songs for the user", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "GET",
          url: "/songs/history",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
        } as MockRequest,
      });

      (mockUserService.getListenedSongs as jest.Mock).mockResolvedValue({
        status: 200,
        body: { listenedSongs: ["song1", "song2"] },
      });

      // Act
      await userController.getListenedSongs(ctx);

      // Assert
      expect(mockUserService.getListenedSongs).toHaveBeenCalledWith(
        "valid_token"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ listenedSongs: ["song1", "song2"] });
    });
  });

  /**
   * Test Suite: listenAlbum
   */
  describe("listenAlbum", () => {
    it("should mark an album as listened", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/albums/listen",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
          body: {
            albumId: "album123",
          },
        } as MockRequest,
      });

      (mockUserService.listenAlbum as jest.Mock).mockResolvedValue({
        status: 201,
        body: { message: "Album listened successfully" },
      });

      // Act
      await userController.listenAlbum(ctx);

      // Assert
      expect(mockUserService.listenAlbum).toHaveBeenCalledWith(
        "valid_token",
        "album123"
      );
      expect(ctx.status).toBe(201);
      expect(ctx.body).toEqual({ message: "Album listened successfully" });
    });
  });

  /**
   * Test Suite: getListenedAlbums
   */
  describe("getListenedAlbums", () => {
    it("should return last 15 listened albums for the user", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "GET",
          url: "/albums/listened",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
        } as MockRequest,
      });

      (mockUserService.getListenedAlbums as jest.Mock).mockResolvedValue({
        status: 200,
        body: { albums: [] },
      });

      // Act
      await userController.getListenedAlbums(ctx);

      // Assert
      expect(mockUserService.getListenedAlbums).toHaveBeenCalledWith(
        "valid_token"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: [] });
    });
  });

  /**
   * Test Suite: changeUsername
   */
  describe("changeUsername", () => {
    it("should change the user's username", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "PATCH",
          url: "/users/username",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
          body: {
            newUsername: "newTestUser",
          },
        } as MockRequest,
      });

      (mockUserService.changeUsername as jest.Mock).mockResolvedValue({
        status: 200,
        body: {
          message: "Username updated successfully",
          newUsername: "newTestUser",
        },
      });

      // Act
      await userController.changeUsername(ctx);

      // Assert
      expect(mockUserService.changeUsername).toHaveBeenCalledWith(
        "valid_token",
        "newTestUser"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({
        message: "Username updated successfully",
        newUsername: "newTestUser",
      });
    });
  });

  /**
   * Test Suite: changePassword
   */
  describe("changePassword", () => {
    it("should change the user's password", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "PATCH",
          url: "/users/password",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
          body: {
            currentPassword: "OldPass123",
            newPassword: "NewPass1234",
          },
        } as MockRequest,
      });

      (mockUserService.changePassword as jest.Mock).mockResolvedValue({
        status: 200,
        body: { message: "Password updated successfully" },
      });

      // Act
      await userController.changePassword(ctx);

      // Assert
      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        "valid_token",
        "OldPass123",
        "NewPass1234"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: "Password updated successfully" });
    });
  });

  /**
   * Test Suite: deleteAccount
   */
  describe("deleteAccount", () => {
    it("should delete the user's account", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "DELETE",
          url: "/users",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
        } as MockRequest,
      });

      (mockUserService.deleteAccount as jest.Mock).mockResolvedValue({
        status: 200,
        body: { message: "Account deleted successfully" },
      });

      // Act
      await userController.deleteAccount(ctx);

      // Assert
      expect(mockUserService.deleteAccount).toHaveBeenCalledWith("valid_token");
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: "Account deleted successfully" });
    });
  });

  /**
   * Test Suite: addFavoriteAlbum
   */
  describe("addFavoriteAlbum", () => {
    it("should add an album to favorites", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "POST",
          url: "/favorite-album",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
          body: {
            albumId: "album123",
          },
        } as MockRequest,
      });

      (mockUserService.addFavoriteAlbum as jest.Mock).mockResolvedValue({
        status: 201,
        body: { message: "Album added to favorites" },
      });

      // Act
      await userController.addFavoriteAlbum(ctx);

      // Assert
      expect(mockUserService.addFavoriteAlbum).toHaveBeenCalledWith(
        "valid_token",
        "album123"
      );
      expect(ctx.status).toBe(201);
      expect(ctx.body).toEqual({ message: "Album added to favorites" });
    });
  });

  /**
   * Test Suite: removeFavoriteAlbum
   */
  describe("removeFavoriteAlbum", () => {
    it("should remove an album from favorites", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "DELETE",
          url: "/favorite-album",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
          body: {
            albumId: "album123",
          },
        } as MockRequest,
      });

      (mockUserService.removeFavoriteAlbum as jest.Mock).mockResolvedValue({
        status: 200,
        body: { message: "Album removed from favorites" },
      });

      // Act
      await userController.removeFavoriteAlbum(ctx);

      // Assert
      expect(mockUserService.removeFavoriteAlbum).toHaveBeenCalledWith(
        "valid_token",
        "album123"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ message: "Album removed from favorites" });
    });
  });

  /**
   * Test Suite: getFavoriteAlbums
   */
  describe("getFavoriteAlbums", () => {
    it("should return all favorite albums of the user", async () => {
      // Arrange
      // Get/Add/Remove favorite album
      const ctx = createMockContext({
        request: {
          method: "GET",
          url: "/favorite-albums",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
        } as MockRequest,
      });

      (mockUserService.getFavoriteAlbums as jest.Mock).mockResolvedValue({
        status: 200,
        body: { albums: ["album1", "album2"] },
      });

      // Act
      await userController.getFavoriteAlbums(ctx);

      // Assert
      expect(mockUserService.getFavoriteAlbums).toHaveBeenCalledWith(
        "valid_token"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ albums: ["album1", "album2"] });
    });
  });

  /**
   * Test Suite: checkIfAlbumIsFavorite
   */
  describe("checkIfAlbumIsFavorite", () => {
    it("should check if the album is favorite", async () => {
      // Arrange
      const ctx = createMockContext({
        request: {
          method: "GET",
          url: "/favorite-album",
          header: {},
          headers: {
            authorization: "Bearer valid_token",
          },
        } as MockRequest,
        query: {
          albumId: "album123",
        },
      });

      (mockUserService.checkIfAlbumIsFavorite as jest.Mock).mockResolvedValue({
        status: 200,
        body: { isFavorite: true },
      });

      // Act
      await userController.checkIfAlbumIsFavorite(ctx);

      // Assert
      expect(mockUserService.checkIfAlbumIsFavorite).toHaveBeenCalledWith(
        "valid_token",
        "album123"
      );
      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ isFavorite: true });
    });
  });
});
