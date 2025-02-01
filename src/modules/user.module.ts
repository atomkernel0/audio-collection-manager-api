/**
 * @file user.module.ts
 * @description Module grouping together the UserController and UserService.
 */

import { UserController } from "../controllers/user.controller";
import { UserService } from "../services/user.service";

export class UserModule {
  public userController: UserController;
  public userService: UserService;

  constructor() {
    this.userService = new UserService();
    this.userController = new UserController(this.userService);
  }
}
