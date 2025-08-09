import express, {
  json,
  urlencoded,
  Express,
  Request,
  Response,
  NextFunction,
  Router,
} from "express";
import cors from "cors";
import { PORT } from "./config/env";
import "reflect-metadata";
import { SampleRouter } from "./modules/sample/sample.router";
import { ApiError } from "./utils/api.error";
import { AuthRouter } from "./modules/auth/auth.router";
import { EventRouter } from "./modules/event/event.router";
import { ProfileRouter } from "./modules/profile/profile.router";
import { TransactionRouter } from "./modules/transaction/transaction.router";
import { DashboardRouter } from "./modules/dashboard/dashboard.router";
import startExpireTransactionJob from "./jobs/cron/expiry.transaction.schedule";
import { ReviewRouter } from "./modules/review/review.router";
import { VoucherRouter } from "./modules/voucher/voucher.router";


export default class App {
  app: Express;

  constructor() {
    this.app = express();
    this.configure();
    this.routes();
    this.handleError();
    this.jobs()
  }

  private configure() {
    this.app.use(cors());
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));
  }

  private handleError() {
    // Not Found Handler
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.includes("/api/")) {
        res
          .status(404)
          .send(
            "We are sorry, the endpoint you are trying to access could not be found on this server. Please ensure the URL is correct!"
          );
      } else {
        next();
      }
    });

    // Error Handler
    this.app.use(
      (error: any, req: Request, res: Response, next: NextFunction) => {
        console.log(error);
        const statusCode =
          error.statusCode ||
          (error.name === "TokenExpiredError" ||
          error.name === "JsonWebTokenError"
            ? 401
            : 500);
        const message =
          error instanceof ApiError || error.isOperational
            ? error.message ||
              error.name === "TokenExpiredError" ||
              error.name === "JsonWebTokenError"
            : "Internal server error. Please try again later!";
        if (req.path.includes("/api/")) {
          res.status(statusCode).json({
            success: false,
            message: message,
          });
        } else {
          next();
        }
      }
    );
  }

  private routes() {
    const sampleRouter = new SampleRouter();
    const authRouter = new AuthRouter();
    const eventRouter = new EventRouter();
    const profileRouter = new ProfileRouter();
    const transactionRouter = new TransactionRouter();
    const dashboardRouter = new DashboardRouter();
    const reviewRouter = new ReviewRouter();
    const voucherRouter = new VoucherRouter();


    this.app.get("/api", (req: Request, res: Response) => {
      res.send(`Hello, Purwadhika Student API!`);
    });

    this.app.use("/api/samples", sampleRouter.getRouter());
    this.app.use("/api/auth", authRouter.getRouter());
    this.app.use("/api", eventRouter.getRouter());
    this.app.use("/api", profileRouter.getRouter());
    this.app.use("/api", transactionRouter.getRouter())
    this.app.use("/api", dashboardRouter.getRouter());
    this.app.use("/api", reviewRouter.getRouter());
    this.app.use("/api", voucherRouter.getRouter());
  }

   private jobs(): void {
    startExpireTransactionJob();
  }

  public start(): void {
    this.app.listen(PORT, () => {
      console.log(`  ➜ [API] Local:   http://localhost:${PORT}/`);
    });
  }
}
