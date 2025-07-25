

import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validateBody } from "../../middlewares/validate.middleware";
import { RegisterDTO } from "./dto/register.dto";

export class AuthRouter {
  private router: Router;
  private authController: AuthController;

  constructor() {
    this.router = Router();
    this.authController = new AuthController();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
   
    this.router.post(
      "/register",
      validateBody(RegisterDTO),
      this.authController.userRegister
    );
    this.router.post(
      "/register/organizer",
      validateBody(RegisterDTO),
      this.authController.organizerRegister
    );
  };

  getRouter = () => {
    
    return this.router;
  };
}
