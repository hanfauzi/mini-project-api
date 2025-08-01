import { Router } from "express";

import { JwtVerify } from "../../middlewares/jwt.verify";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware";
import { ProfileController } from "./profile.controller";

export class ProfileRouter {
  private router: Router;
  private profileController: ProfileController;
  private uploaderMiddleware: UploaderMiddleware;

  constructor() {
    this.router = Router();
    this.profileController = new ProfileController();
    this.uploaderMiddleware = new UploaderMiddleware();
    this.initializedRoutes();
  }
  private initializedRoutes = () => {
    this.router.patch(
      "/profile",
      JwtVerify.verifyToken,
      JwtVerify.verifyRole(["USER"]),
      this.uploaderMiddleware.upload().single("image"),
      this.profileController.userProfileUpdate
    );

    this.router.patch(
      "/organizer/profile",
      JwtVerify.verifyToken,
      JwtVerify.verifyRole(["ORGANIZER"]),
      this.uploaderMiddleware.upload().single("image"),
      this.profileController.organizerProfileUpdate
    );

    this.router.get(
      "/profile",
      JwtVerify.verifyToken,
      JwtVerify.verifyRole(["USER"]),
      this.profileController.userProfile
    );

    this.router.get(
      "/organizer/profile",
      JwtVerify.verifyToken,
      JwtVerify.verifyRole(["ORGANIZER"]),
      this.profileController.organizerProfile
    );

    this.router.patch(
      "/reset-password",
      JwtVerify.verifyToken,
      JwtVerify.verifyRole(["USER"]),
      this.profileController.userResetPassword
    );

      this.router.patch(
      "/organizer/reset-password",
      JwtVerify.verifyToken,
      JwtVerify.verifyRole(["ORGANIZER"]),
      this.profileController.organizerResetPassword
    );
  };

  getRouter = () => {
    return this.router;
  };
}
