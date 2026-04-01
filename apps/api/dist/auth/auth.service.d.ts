import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export interface RegisterDto {
    email: string;
    password: string;
    name: string;
}
export interface LoginDto {
    email: string;
    password: string;
}
export interface AuthResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string;
    };
}
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(dto: RegisterDto): Promise<AuthResponse>;
    login(dto: LoginDto): Promise<AuthResponse>;
    validateUser(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        organizationId: string;
        createdAt: Date;
    }>;
}
