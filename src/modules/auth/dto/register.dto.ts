import { IsEmail, isNotEmpty, IsNotEmpty, IsString } from "class-validator";

export class RegisterDTO {
  @IsNotEmpty()
  @IsString()
  username!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}
