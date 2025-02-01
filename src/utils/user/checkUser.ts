import { IUser } from "../../interfaces/user.interface";
import { UserModel } from "../../models/user.model";
import { UserSearchCriteria, UserSearchResult } from "./interfaces";

/**
 * Searches for a user in the database according to specified criteria
 * @param criteria - Search criteria for the user
 * @returns Promise with the search result
 * @throws Error if criteria are invalid
 */
export default async function checkUser(
  criteria: UserSearchCriteria
): Promise<UserSearchResult<IUser>> {
  if (!criteria || Object.keys(criteria).length === 0) {
    return {
      data: null,
      success: false,
      error: {
        message: "Search criteria are required",
        code: "INVALID_CRITERIA",
      },
    };
  }

  try {
    const user = await UserModel.findOne(criteria).exec();

    return {
      data: user,
      success: !!user,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      data: null,
      success: false,
      error: {
        message: `Error while searching for user: ${errorMessage}`,
        code: "SEARCH_ERROR",
      },
    };
  }
}
