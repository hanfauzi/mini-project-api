import dayjs from "dayjs";
import { createToken } from "../../lib/jwt";
import { generateReferralCode } from "../../lib/referral.code";
import { generateVoucherCode } from "../../lib/voucher.code";
import crypto from "crypto";
import { ApiError } from "../../utils/api.error";
import { PasswordService } from "../password/password.service";
import fs from "fs";
import prisma from "../prisma/prisma.service";
import { LoginDTO } from "./dto/login.dto";
import { RegisterDTO } from "./dto/register.dto";
import { transporter } from "../../lib/nodemailer";
import Handlebars from "handlebars";
import { EmailDTO } from "./dto/email.forgot.password.dto";
import { ForgotPasswordDTO } from "./dto/forgot.password.dto";

export class AuthService {
  private passwordService: PasswordService;

  constructor() {
    this.passwordService = new PasswordService();
  }

  userRegister = async ({
    username,
    email,
    password,
    referralCode,
  }: RegisterDTO) => {
    const findUserByEmail = await prisma.user.findFirst({ where: { email } });

    if (findUserByEmail) {
      throw new ApiError("Email already exist!", 400);
    }

    const findUserByUsername = await prisma.user.findFirst({
      where: { username },
    });

    if (findUserByUsername) {
      throw new ApiError("Username already used!", 400);
    }

    let findReferredBy = null;
    if (referralCode && referralCode.trim() !== "") {
      findReferredBy = await prisma.user.findFirst({
        where: { referralCode },
      });

      if (!findReferredBy) {
        throw new ApiError("Referral Code Invalid!", 400);
      }
    }

    const hashedPassword = await this.passwordService.hashPassword(password);
    const referralCodeUser = generateReferralCode(username);

    return await prisma.$transaction(async (tx) => {
      // NEW USER
      const newUser = await tx.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          referralCode: referralCodeUser,
          referredById: findReferredBy?.id,
        },
        select: {
          id: true,
          username: true,
          email: true,
          referralCode: true,
          createdAt: true,
          referredById: true,
        },
      });

      // POINT USER YANG DIPAKE REFERRALNYA
      if (findReferredBy) {
        await tx.userPointLog.create({
          data: { userId: findReferredBy.id, amount: 10000, type: "EARN" },
        });
      }

      // VOUCHER UNTUK USER BARU
      const voucher = await tx.voucher.create({
        data: {
          code: `${generateVoucherCode()}`,
          quota: 1,
          discountAmount: 10000,
          startDate: new Date(),
          endDate: dayjs().add(3, "month").toDate(),
          isActive: true,
        },
      });

      return { ...newUser, voucher: voucher.code };
    });
  };

  organizerRegister = async ({ username, email, password }: RegisterDTO) => {
    const findOrganizerByEmail = await prisma.organizer.findFirst({
      where: { email },
    });

    if (findOrganizerByEmail) {
      throw new ApiError("Email already exist!", 400);
    }

    const findOrganizerByUsername = await prisma.organizer.findFirst({
      where: { username },
    });

    if (findOrganizerByUsername) {
      throw new ApiError("Username already used!", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(password);

    return await prisma.organizer.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });
  };

  userLogin = async ({ usernameOrEmail, password }: LoginDTO) => {
    const isEmail = usernameOrEmail.includes("@");
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail },
    });

    if (!user) {
      throw new ApiError("Account not registered!", 404);
    }

    const comparedPassword = await this.passwordService.comparePassword(
      password,
      user.password
    );

    if (!comparedPassword) {
      throw new ApiError("Password Invalid!", 401);
    }

    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      referralCode: user.referralCode,
    };

    const token = createToken({
      payload,
      secretKey: process.env.JWT_SECRET_KEY!,
      options: { expiresIn: "1h" },
    });

    return { token, payload };
  };

  organizerLogin = async ({ usernameOrEmail, password }: LoginDTO) => {
    const isEmail = usernameOrEmail.includes("@");
    const organizer = await prisma.organizer.findFirst({
      where: isEmail
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail },
    });

    if (!organizer) {
      throw new ApiError("Account not registered!", 404);
    }

    const comparedPassword = await this.passwordService.comparePassword(
      password,
      organizer.password
    );

    if (!comparedPassword) {
      throw new ApiError("Password Invalid!", 401);
    }

    const payload = {
      userId: organizer.id,
      username: organizer.username,
      email: organizer.email,
      role: organizer.role,
      orgName: organizer.orgName,
    };

    const token = createToken({
      payload,
      secretKey: process.env.JWT_SECRET_KEY!,
      options: { expiresIn: "1h" },
    });

    return { token, payload };
  };

  sendUserForgotPasswordEmail = async ({ email }: EmailDTO) => {
    const user = await prisma.user.findUnique({
      where: { email }, // 👈 ini yang benar
    });

    if (!user) {
      throw new ApiError("User with that email does not exist!", 404);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = dayjs().add(1, "hour").toDate();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiry: expiry,
      },
    });

    const templateHtml = await fs.readFileSync(
      "src/assets/forgotPassword.html",
      "utf-8"
    );
    const compiledHtml = Handlebars.compile(templateHtml);
    const resultHtml = compiledHtml({
      name: user.firstName ?? user.username ?? "there",
      linkUrl: `${process.env.RESET_PASSWORD_URL!}/${token}`,
    });

    await transporter.sendMail({
      subject: "Reset Your Password",
      to: email,
      html: resultHtml,
    });

    return {token, message: "Reset link sent to email" };
  };

  sendOrganizerForgotPasswordEmail = async ({ email }: EmailDTO) => {
    const organizer = await prisma.organizer.findUnique({
      where: { email }, // 👈 ini yang benar
    });

    if (!organizer) {
      throw new ApiError("Organizer with that email does not exist!", 404);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = dayjs().add(1, "hour").toDate();

    await prisma.organizer.update({
      where: { id: organizer.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiry: expiry,
      },
    });

    const templateHtml = await fs.readFileSync(
      "src/assets/forgotPassword.html",
      "utf-8"
    );
    const compiledHtml = Handlebars.compile(templateHtml);
    const resultHtml = compiledHtml({
      name: organizer.orgName ?? organizer.username ?? "there",
      linkUrl: `${process.env.RESET_PASSWORD_URL!}/${token}`,
    });

    await transporter.sendMail({
      subject: "Reset Your Password",
      to: email,
      html: resultHtml,
    });

    return { token, message: "Reset link sent to email" };
  };

  forgotUserPasswordByToken = async ({ token, newPassword }: ForgotPasswordDTO & {token: string}) => {
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: token,
      resetPasswordExpiry: {
        gte: new Date(), // token belum expired
      },
    },
  });

  if (!user) {
    throw new ApiError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await this.passwordService.hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
    },
  });

  return { message: "Password has been reset successfully" };

  
};

 forgotOrganizerPasswordByToken = async ({ token, newPassword }: ForgotPasswordDTO & {token: string}) => {
  const organizer = await prisma.organizer.findFirst({
    where: {
      resetPasswordToken: token,
      resetPasswordExpiry: {
        gte: new Date(), // token belum expired
      },
    },
  });

  if (!organizer) {
    throw new ApiError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await this.passwordService.hashPassword(newPassword);

  await prisma.organizer.update({
    where: { id: organizer.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
    },
  });

  return { message: "Password has been reset successfully" };
}
}
