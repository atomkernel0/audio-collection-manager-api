import { IUser } from "../../interfaces/user.interface";
import { UserModel } from "../../models/user.model";
import { CreateUserInput, CreateUserResult } from "./interfaces";
import { hash } from "bcrypt";

/**
 * Creates a new user in the database
 * @param input - The user data to create
 * @returns Promise with the creation result
 */
export default async function createUser(
  input: CreateUserInput
): Promise<CreateUserResult<IUser>> {
  if (!input.username?.trim()) {
    return {
      data: null,
      success: false,
      error: {
        message: "Username is required",
        code: "INVALID_USERNAME",
      },
    };
  }

  if (!input.password?.trim() || input.password.length < 6) {
    return {
      data: null,
      success: false,
      error: {
        message: "Password must contain at least 6 characters",
        code: "INVALID_PASSWORD",
      },
    };
  }

  try {
    const existingUser = await UserModel.findOne({ username: input.username });
    if (existingUser) {
      return {
        data: null,
        success: false,
        error: {
          message: "This username already exists",
          code: "USERNAME_EXISTS",
        },
      };
    }

    const hashedPassword = await hash(input.password, 10);

    const user = await UserModel.create({
      username: input.username,
      password: hashedPassword,
      playlists: input.playlists || [],
    });

    return {
      data: user,
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      data: null,
      success: false,
      error: {
        message: `Error while creating user: ${errorMessage}`,
        code: "CREATE_ERROR",
      },
    };
  }
}
